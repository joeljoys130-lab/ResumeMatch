import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { startInterviewSession, submitQuestionAnswer, finalizeInterviewSession } from '../src/services/interviewService.js';
import prisma from '../src/config/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testFullInterviewWorkflow() {
  console.log('🚀 Starting Full 4-Turn AI Interview Integration Test...');

  const config = {
    role: 'Senior Full Stack Engineer',
    experienceLevel: 'Senior',
    technology: 'React, Node.js & PostgreSQL',
    interviewType: 'Technical Deep Dive'
  };

  // Create demo user if not exists
  let user = await prisma.user.findFirst({ where: { email: 'demo@resumematch.ai' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Demo User',
        email: 'demo@resumematch.ai',
        passwordHash: 'dummy'
      }
    });
  }

  // 1. Start session
  const { session, firstQuestion } = await startInterviewSession(user.id, config);
  console.log(`\n✅ Session #${session.id} Started.`);
  console.log(`❓ Question 1: "${firstQuestion.question}"`);

  const answers = [
    'I build modular React apps using clean components, custom hooks for state isolation, and RESTful Node.js Express APIs backed by PostgreSQL.',
    'I use async/await with try/catch blocks, Zod schema validation for inputs, and global error middleware for consistent API error responses.',
    'I analyze performance using Chrome Performance tab and Node.js profiler. I use database indexing, Prisma query optimization, and Redis caching.',
    'I write automated tests using Jest and Supertest, use React Error Boundaries, and implement circuit breaker pattern for external APIs.'
  ];

  const questionsAsked = [firstQuestion.question];
  const scoresRecorded = [];

  for (let turn = 1; turn <= 4; turn++) {
    console.log(`\n--- Turn ${turn} ---`);
    console.log(`💬 Candidate Answer: "${answers[turn - 1]}"`);

    const result = await submitQuestionAnswer(user.id, session.id, answers[turn - 1]);
    const evalData = result.evaluation;

    console.log(`📊 Evaluation Turn ${turn}: Score=${evalData.score}/10 (Tech=${evalData.technicalAccuracy}/10, Comm=${evalData.communication}/10)`);
    console.log(`💡 Feedback: "${evalData.feedback}"`);
    scoresRecorded.push(evalData.score);

    if (result.nextQuestion) {
      console.log(`❓ Question ${turn + 1}: "${result.nextQuestion.question}"`);
      questionsAsked.push(result.nextQuestion.question);
    }
  }

  // Finalize session
  console.log('\n🏁 Finalizing Interview Session...');
  const finalResult = await finalizeInterviewSession(user.id, session.id);
  const completedSession = finalResult.session;

  const expectedAvgScore = scoresRecorded.reduce((a, b) => a + b, 0) / scoresRecorded.length;
  const expectedOverallScore = Math.round(expectedAvgScore * 10);

  console.log(`\n================ FINAL RESULTS ================`);
  console.log(`Individual Turn Scores (0-10): [${scoresRecorded.join(', ')}]`);
  console.log(`Calculated Average Turn Score: ${expectedAvgScore.toFixed(2)}/10`);
  console.log(`Normalized Overall Score (0-100): ${completedSession.overallScore}/100`);
  console.log(`Expected Score Match: ${completedSession.overallScore === expectedOverallScore ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Unique Questions Generated (Total ${questionsAsked.length}): ${new Set(questionsAsked).size === questionsAsked.length ? 'YES ✅ (Zero Duplicates)' : 'NO ❌'}`);
  console.log(`Report Score Match: ${finalResult.finalReport.includes(`Overall Score:** ${expectedOverallScore}/100`) ? 'YES ✅' : 'NO ❌'}`);
  console.log(`===============================================`);

  await prisma.$disconnect();
}

testFullInterviewWorkflow().catch(console.error);
