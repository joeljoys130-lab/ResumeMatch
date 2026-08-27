import 'dotenv/config';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import mongoose from 'mongoose';
import { connectMongo } from '../src/config/mongo.js';
import ResumeAnalysis from '../src/models/ResumeAnalysis.js';
import LLMResponse from '../src/models/LLMResponse.js';
import AIConversation from '../src/models/AIConversation.js';
import { getAdminPlatformAnalytics } from '../src/services/analyticsService.js';
import { generateAnalysisCacheKey } from '../src/utils/hashes.js';
import { getCachedAnalysis, setCachedAnalysis } from '../src/services/cacheService.js';
import { queryRAGAssistant } from '../src/services/ragService.js';
import { executeToolCall } from '../src/services/toolService.js';
import { startInterviewSession, submitQuestionAnswer, finalizeInterviewSession } from '../src/services/interviewService.js';
import { scanStaleApplicationReminders } from '../src/jobs/cronJobs.js';

async function runQA() {
  console.log('============ STARTING COMPREHENSIVE QA VERIFICATION ============');

  await prisma.$connect();
  await connectMongo();

  // 1. VERIFY AUTH & PERSISTENCE
  console.log('\n--- 1. AUTH & POSTGRESQL PERSISTENCE ---');
  const signupEmail = `qa_user_${Date.now()}@resumematch.ai`;
  const signupRes = await request(app).post('/api/auth/signup').send({
    name: 'QA Test User',
    email: signupEmail,
    password: 'Password123!'
  });
  console.log('✓ POST /api/auth/signup:', signupRes.status, signupRes.body.success ? 'SUCCESS' : 'FAILED');

  const loginRes = await request(app).post('/api/auth/login').send({
    email: signupEmail,
    password: 'Password123!'
  });
  const userToken = loginRes.body.data.token;
  const userId = loginRes.body.data.user.id;
  console.log('✓ POST /api/auth/login:', loginRes.status, 'User ID:', userId);

  const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${userToken}`);
  console.log('✓ GET /api/auth/me:', meRes.status, meRes.body.data.user.email);

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  console.log('✓ PostgreSQL Persistence Verification:', dbUser ? 'VERIFIED' : 'FAILED');

  // 2. VERIFY RBAC (USER vs ADMIN)
  console.log('\n--- 2. RBAC AUTHORIZATION ---');
  const userAdminAttempt = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${userToken}`);
  console.log('✓ USER role attempt on /api/admin/analytics:', userAdminAttempt.status, '(Expected 403)');

  // Login as Admin
  const adminLoginRes = await request(app).post('/api/auth/login').send({
    email: process.env.ADMIN_EMAIL || 'admin@resumematch.ai',
    password: process.env.ADMIN_PASSWORD || 'AdminPassword123!'
  });
  const adminToken = adminLoginRes.body.data.token;

  const adminAttempt = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${adminToken}`);
  console.log('✓ ADMIN role attempt on /api/admin/analytics:', adminAttempt.status, '(Expected 200)');

  // 3. VERIFY MONGODB CRUD & AGGREGATION
  console.log('\n--- 3. MONGODB & AGGREGATION PIPELINE ---');
  const testAnalysis = await ResumeAnalysis.create({
    userId,
    resumeFileName: 'qa-resume.pdf',
    resumeText: 'React Node.js Developer with 4 years experience',
    jobDescriptionText: 'Full Stack Engineer with React and Node.js',
    result: {
      matchScore: 88,
      atsScore: 90,
      experienceMatch: 'Strong fit',
      matchedSkills: ['React', 'Node.js'],
      missingSkills: ['Docker'],
      strengths: ['Solid JS foundation'],
      weaknesses: ['Needs cloud experience'],
      recommendations: ['Add Docker certification'],
      summary: 'Strong candidate for full stack role.'
    },
    inputTokens: 300,
    outputTokens: 150,
    totalTokens: 450,
    estimatedCost: 0.003
  });
  console.log('✓ MongoDB ResumeAnalysis Created:', testAnalysis._id);

  const analyticsData = await getAdminPlatformAnalytics();
  console.log('✓ MongoDB Aggregation Pipeline Executed:', {
    totalAnalyses: analyticsData.analyses.totalAnalyses,
    avgMatchScore: analyticsData.analyses.avgMatchScore,
    topMissingSkillsCount: analyticsData.topMissingSkills.length
  });

  // 4. VERIFY REDIS CACHE STRATEGY
  console.log('\n--- 4. REDIS CACHE ENGINE ---');
  const cacheKey = generateAnalysisCacheKey('test resume text', 'test job description text');
  const cachedVal = await getCachedAnalysis('test resume text', 'test job description text');
  console.log('✓ Initial Redis Cache Read (Miss):', cachedVal === null ? 'MISS (Expected)' : 'HIT');

  await setCachedAnalysis('test resume text', 'test job description text', { matchScore: 92 });
  const cachedValAfter = await getCachedAnalysis('test resume text', 'test job description text');
  console.log('✓ Subsequent Redis Cache Read (Hit):', cachedValAfter?.matchScore === 92 ? 'HIT (92%)' : 'MISS');

  // 5. VERIFY REAL RAG & CITATIONS
  console.log('\n--- 5. RAG CAREER ASSISTANT & CITATIONS ---');
  const ragResult = await queryRAGAssistant('How should I structure my resume bullet points?', userId);
  console.log('✓ RAG Answer Generated:', ragResult.answer.slice(0, 100) + '...');
  console.log('✓ Grounded Source Citations:', ragResult.citations.map(c => c.title));

  const ragOutsideResult = await queryRAGAssistant('What is the recipe for baking chocolate cake?', userId);
  console.log('✓ RAG Out-of-bounds Query Handling:', ragOutsideResult.answer.includes("don't have enough information") ? 'HANDLED (No Fabrication)' : 'FAILED');

  // 6. VERIFY CONTROLLED FUNCTION CALLING (TOOLS)
  console.log('\n--- 6. CONTROLLED FUNCTION CALLING ---');
  const userAppsToolResult = await executeToolCall('getUserApplications', { limit: 5 }, userId);
  console.log('✓ Tool getUserApplications executed:', userAppsToolResult.count, 'apps found');

  try {
    await executeToolCall('getApplicationDetails', { applicationId: 999999 }, userId);
  } catch (err) {
    console.log('✓ Tool unauthorized/invalid resource check:', err.message);
  }

  // 7. VERIFY MULTI-STEP AI INTERVIEW AGENT
  console.log('\n--- 7. ADAPTIVE MULTI-STEP INTERVIEW AGENT ---');
  const interviewSession = await startInterviewSession(userId, {
    role: 'Full Stack Engineer',
    experienceLevel: 'Senior',
    technology: 'Node.js & React',
    interviewType: 'Technical'
  });
  console.log('✓ Interview Session Created ID:', interviewSession.session.id);
  console.log('✓ Initial Question:', interviewSession.firstQuestion.question);

  const answerEval = await submitQuestionAnswer(userId, interviewSession.session.id, 'I use React functional components with custom hooks and memoization for state management.');
  console.log('✓ Answer Evaluated - Score:', answerEval.evaluation.score, '/ 10');

  const finalReport = await finalizeInterviewSession(userId, interviewSession.session.id);
  console.log('✓ Final Interview Report Synthesized:', finalReport.completedAt ? 'COMPLETED' : 'PENDING');

  // 8. VERIFY CRON JOBS
  console.log('\n--- 8. CRON SCHEDULED JOBS ---');
  const staleApps = await scanStaleApplicationReminders();
  console.log('✓ Stale Application Reminder Scanner Executed:', staleApps.length, 'stale applications scanned.');

  // CLEANUP
  await prisma.user.delete({ where: { id: userId } });
  await ResumeAnalysis.deleteOne({ _id: testAnalysis._id });
  await prisma.$disconnect();

  console.log('\n============ QA VERIFICATION COMPLETE ============');
}

runQA().catch(console.error);
