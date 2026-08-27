import prisma from '../config/prisma.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { TOOL_DEFINITIONS } from '../prompts/schemas.js';

/**
 * CONTROLLED FUNCTION CALLING SERVICE
 * Strictly validates tool arguments and enforces user authorization checks.
 * Prevents direct LLM access to databases or system internals.
 */

export function getAvailableTools() {
  return TOOL_DEFINITIONS;
}

export async function executeToolCall(toolName, toolInput, authenticatedUserId) {
  if (!authenticatedUserId) {
    throw new ForbiddenError('Tool execution requires authentication.');
  }

  console.log(`🛠️ Executing controlled tool '${toolName}' for user ID ${authenticatedUserId}...`);

  switch (toolName) {
    case 'getUserApplications':
      return await getUserApplicationsTool(toolInput, authenticatedUserId);

    case 'getApplicationDetails':
      return await getApplicationDetailsTool(toolInput, authenticatedUserId);

    case 'getResumeAnalysis':
      return await getResumeAnalysisTool(toolInput, authenticatedUserId);

    case 'calculateSkillGap':
      return await calculateSkillGapTool(toolInput, authenticatedUserId);

    case 'saveInterviewResult':
      return await saveInterviewResultTool(toolInput, authenticatedUserId);

    default:
      throw new ValidationError(`Unknown or unauthorized tool call: '${toolName}'`);
  }
}

async function getUserApplicationsTool(input, userId) {
  const status = input?.status;
  const limit = Math.min(input?.limit || 10, 50);

  const where = { userId };
  if (status) {
    where.currentStatus = status;
  }

  const applications = await prisma.application.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      jobDescription: {
        select: { title: true, company: true }
      }
    }
  });

  return {
    count: applications.length,
    applications: applications.map(a => ({
      id: a.id,
      company: a.company,
      jobTitle: a.jobTitle,
      status: a.currentStatus,
      appliedAt: a.appliedAt,
      createdAt: a.createdAt
    }))
  };
}

async function getApplicationDetailsTool(input, userId) {
  const applicationId = Number(input?.applicationId);
  if (!applicationId) throw new ValidationError('Invalid applicationId');

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId }, // Ownership check
    include: {
      jobDescription: true,
      statusHistory: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!application) {
    throw new NotFoundError(`Application #${applicationId} not found or unauthorized.`);
  }

  return application;
}

async function getResumeAnalysisTool(input, userId) {
  const analysisId = input?.analysisId;
  if (!analysisId) throw new ValidationError('Invalid analysisId');

  const analysis = await ResumeAnalysis.findOne({ _id: analysisId, userId }); // Ownership check
  if (!analysis) {
    throw new NotFoundError('Resume analysis record not found or unauthorized.');
  }

  return {
    id: analysis._id,
    matchScore: analysis.result.matchScore,
    atsScore: analysis.result.atsScore,
    matchedSkills: analysis.result.matchedSkills,
    missingSkills: analysis.result.missingSkills,
    summary: analysis.result.summary,
    createdAt: analysis.createdAt
  };
}

async function calculateSkillGapTool(input, userId) {
  const applicationId = Number(input?.applicationId);
  if (!applicationId) throw new ValidationError('Invalid applicationId');

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: { jobDescription: true }
  });

  if (!application) {
    throw new NotFoundError(`Application #${applicationId} not found or unauthorized.`);
  }

  // Find latest analysis for user
  const latestAnalysis = await ResumeAnalysis.findOne({ userId }).sort({ createdAt: -1 });

  const candidateSkills = latestAnalysis?.result?.matchedSkills || [];
  const missingSkills = latestAnalysis?.result?.missingSkills || ['Cloud/Docker', 'System Architecture'];

  return {
    applicationId,
    jobTitle: application.jobTitle,
    company: application.company,
    matchedCount: candidateSkills.length,
    missingCount: missingSkills.length,
    candidateSkills,
    missingSkills,
    recommendation: missingSkills.length > 0
      ? `Prioritize building proficiency in ${missingSkills.slice(0, 3).join(', ')}.`
      : 'Skills are well aligned for this position!'
  };
}

async function saveInterviewResultTool(input, userId) {
  const sessionId = Number(input?.sessionId);
  const score = Number(input?.score);
  const feedback = input?.feedback || '';

  if (!sessionId) throw new ValidationError('Invalid sessionId');

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId } // Ownership check
  });

  if (!session) {
    throw new NotFoundError(`Interview session #${sessionId} not found or unauthorized.`);
  }

  const updatedSession = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      overallScore: score,
      finalReport: feedback,
      status: 'COMPLETED',
      completedAt: new Date()
    }
  });

  return {
    sessionId: updatedSession.id,
    status: updatedSession.status,
    overallScore: updatedSession.overallScore,
    message: 'Interview evaluation report saved successfully.'
  };
}
