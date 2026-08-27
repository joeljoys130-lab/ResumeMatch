import prisma from '../config/prisma.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
import { extractResumeText } from '../services/parserService.js';
import { analyzeResumeWithClaude } from '../services/llmService.js';
import { getCachedAnalysis, setCachedAnalysis } from '../services/cacheService.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const createAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const file = req.file;
  const jobDescriptionText = req.body.jobDescription || '';
  const jobTitle = req.body.jobTitle || 'Target Position';
  const company = req.body.company || 'Target Company';

  if (!jobDescriptionText || jobDescriptionText.trim().length < 50) {
    throw new ValidationError('Job description must be at least 50 characters long.');
  }

  // 1. Extract text from PDF/DOCX (Guarantees file deletion inside extractResumeText)
  const resumeText = await extractResumeText(file);
  const resumeFileName = file.originalname;

  // 2. Check Redis Cache
  let analysisData = await getCachedAnalysis(resumeText, jobDescriptionText);
  let isCached = false;

  if (analysisData) {
    isCached = true;
  } else {
    // 3. Call Claude LLM Analysis Service
    const llmOutput = await analyzeResumeWithClaude(resumeText, jobDescriptionText, userId);
    analysisData = {
      result: llmOutput.result,
      tokenUsage: llmOutput.tokenUsage
    };

    // Cache successful result in Redis (24 hours)
    await setCachedAnalysis(resumeText, jobDescriptionText, analysisData);
  }

  // 4. Save LLM result to MongoDB (ResumeAnalysis document)
  const mongoAnalysis = await ResumeAnalysis.create({
    userId,
    resumeFileName,
    resumeText,
    jobDescriptionText,
    result: analysisData.result,
    inputTokens: analysisData.tokenUsage?.inputTokens || 0,
    outputTokens: analysisData.tokenUsage?.outputTokens || 0,
    totalTokens: analysisData.tokenUsage?.totalTokens || 0,
    estimatedCost: analysisData.tokenUsage?.estimatedCost || 0,
    model: analysisData.tokenUsage?.model || 'claude-3-5-sonnet-20241022',
    latencyMs: analysisData.tokenUsage?.latencyMs || 0,
    cached: isCached
  });

  // 5. PostgreSQL Transaction: Save JobDescription and initial Application atomically
  const [dbJobDescription, dbApplication] = await prisma.$transaction(async (tx) => {
    const jd = await tx.jobDescription.create({
      data: {
        userId,
        title: jobTitle,
        company,
        content: jobDescriptionText
      }
    });

    const app = await tx.application.create({
      data: {
        userId,
        jobDescriptionId: jd.id,
        company,
        jobTitle,
        currentStatus: 'SAVED',
        notes: `Analysis generated on ${new Date().toLocaleDateString()}. Match Score: ${analysisData.result.matchScore}%`,
        statusHistory: {
          create: [{ status: 'SAVED', notes: 'Initial analysis created' }]
        }
      }
    });

    return [jd, app];
  });

  // Update MongoDB document with PostgreSQL JobDescription ID reference
  await ResumeAnalysis.updateOne({ _id: mongoAnalysis._id }, { jobDescriptionId: dbJobDescription.id });

  return sendSuccess(res, {
    analysisId: mongoAnalysis._id,
    applicationId: dbApplication.id,
    jobDescriptionId: dbJobDescription.id,
    cached: isCached,
    result: analysisData.result,
    tokenUsage: analysisData.tokenUsage,
    createdAt: mongoAnalysis.createdAt
  }, 201, 'Resume analysis completed and persisted successfully.');
});

export const listAnalyses = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const analyses = await ResumeAnalysis.find({ userId })
    .sort({ createdAt: -1 })
    .select('_id resumeFileName result.matchScore result.atsScore result.summary createdAt cached')
    .lean();

  return sendSuccess(res, { analyses });
});

export const getAnalysisById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const mongoAnalysis = await ResumeAnalysis.findOne({ _id: id, userId });
  if (!mongoAnalysis) {
    throw new NotFoundError('Resume analysis record not found.');
  }

  // Related PostgreSQL application if present
  let postgresApp = null;
  if (mongoAnalysis.jobDescriptionId) {
    postgresApp = await prisma.application.findFirst({
      where: { jobDescriptionId: mongoAnalysis.jobDescriptionId, userId }
    });
  }

  return sendSuccess(res, {
    analysis: mongoAnalysis,
    application: postgresApp
  });
});

export const deleteAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const deleted = await ResumeAnalysis.findOneAndDelete({ _id: id, userId });
  if (!deleted) {
    throw new NotFoundError('Resume analysis record not found.');
  }

  return sendSuccess(res, { message: 'Analysis deleted successfully.' });
});
