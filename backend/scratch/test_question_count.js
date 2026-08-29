import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { startInterviewSession, submitQuestionAnswer, finalizeInterviewSession } from '../src/services/interviewService.js';
import prisma from '../src/config/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testQuestionCountProgression() {
  console.log('🧪 Starting User-Selectable Question Count Verification (5, 10, 15 Questions)...\n');

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

  const sampleAnswers = [
    'I build modular React apps using clean functional components, custom hooks, and Express REST APIs.',
    'I handle async operations using async/await, try/catch blocks, Zod schema validation, and error middleware.',
    'I profile Node.js apps using Chrome DevTools and clinic.js, and optimize React using memoization.',
    'I write unit tests using Jest, API integration tests with Supertest, and React Error Boundaries.',
    'I configure Docker containers and setup Nginx reverse proxy with Redis caching for scale.',
    'I optimize SQL queries using Prisma indexing, EXPLAIN ANALYZE, and connection pooling.',
    'I implement JWT authentication with HTTP-only cookies and role-based access control middleware.',
    'I use Server-Sent Events for real-time progress streaming and background job scheduling.',
    'I implement zero-downtime rolling deployments using Docker Compose and health check endpoints.',
    'I design modular microservices with event-driven architecture and asynchronous message queues.',
    'I implement rate limiting, CORS configuration, and security header middleware using Helmet.',
    'I write end-to-end integration tests and conduct load testing using k6 for bottleneck analysis.',
    'I optimize frontend bundle size using dynamic imports, code splitting, and tree shaking.',
    'I implement distributed caching strategies using Redis with TTL expiration and fallback layers.',
    'I establish CI/CD pipelines with automated test suites, linting checks, and staging deployments.'
  ];

  const countsToTest = [5, 10, 15];
  const summary = [];

  for (const count of countsToTest) {
    console.log(`\n=================== TESTING ${count}-QUESTION INTERVIEW ===================`);

    const { session, firstQuestion } = await startInterviewSession(user.id, {
      role: 'Staff Full Stack Engineer',
      experienceLevel: 'Senior',
      technology: 'React, Node.js & PostgreSQL',
      interviewType: 'Technical',
      questionCount: count
    });

    console.log(`Session #${session.id} initialized with questionCount = ${session.questionCount}`);

    let currentTurn = 1;
    let isCompleted = false;
    const turnScores = [];
    const generatedQuestions = [firstQuestion.question];

    while (!isCompleted && currentTurn <= count) {
      const answer = sampleAnswers[(currentTurn - 1) % sampleAnswers.length];
      const result = await submitQuestionAnswer(user.id, session.id, answer);

      turnScores.push(result.updatedQuestion.score);
      isCompleted = result.completed;

      if (currentTurn < count) {
        if (isCompleted) {
          console.error(`❌ ERROR: Session prematurely finalized at Turn ${currentTurn} instead of ${count}!`);
          break;
        }
        if (result.nextQuestion) {
          generatedQuestions.push(result.nextQuestion.question);
        }
      }

      currentTurn++;
    }

    // Finalize session
    const finalResult = await finalizeInterviewSession(user.id, session.id);
    const finalSession = finalResult.session;

    const avgScore = turnScores.reduce((a, b) => a + b, 0) / turnScores.length;
    const expectedOverallScore = Math.round(avgScore * 10);

    const uniqueQuestions = new Set(generatedQuestions);

    summary.push({
      targetCount: count,
      persistedCount: finalSession.questionCount,
      totalQuestionsGenerated: generatedQuestions.length,
      uniqueQuestionsCount: uniqueQuestions.size,
      totalTurnsCompleted: turnScores.length,
      overallScore: finalSession.overallScore,
      expectedOverallScore,
      finalizedAtCorrectTurn: turnScores.length === count && isCompleted,
      reportContainsScore: finalResult.finalReport.includes(`Overall Score:** ${expectedOverallScore}/100`)
    });
  }

  console.log('\n================ QUESTION COUNT VERIFICATION SUMMARY ================');
  summary.forEach(s => {
    console.log(`\n📌 ${s.targetCount}-Question Interview Session:`);
    console.log(`   - Persisted questionCount: ${s.persistedCount}`);
    console.log(`   - Questions Generated: ${s.totalQuestionsGenerated}`);
    console.log(`   - Unique Questions: ${s.uniqueQuestionsCount}`);
    console.log(`   - Turns Completed: ${s.totalTurnsCompleted}`);
    console.log(`   - Overall Score: ${s.overallScore}/100 (Expected: ${s.expectedOverallScore}/100)`);
    console.log(`   - Correct Finalization: ${s.finalizedAtCorrectTurn ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`   - Report Text Verification: ${s.reportContainsScore ? 'PASS ✅' : 'FAIL ❌'}`);
  });

  const allPassed = summary.every(s => s.finalizedAtCorrectTurn && s.reportContainsScore && s.uniqueQuestionsCount === s.targetCount);
  console.log(`\n=======================================================`);
  console.log(`ALL QUESTION COUNT TESTS: ${allPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`=======================================================\n`);

  await prisma.$disconnect();
}

testQuestionCountProgression().catch(console.error);
