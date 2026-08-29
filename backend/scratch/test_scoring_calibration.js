import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { startInterviewSession, submitQuestionAnswer } from '../src/services/interviewService.js';
import prisma from '../src/config/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testControlledScoringCalibration() {
  console.log('🧪 Starting Controlled AI Interview Answer Relevance & Calibration Test...\n');

  const config = {
    role: 'Senior Full Stack Engineer',
    experienceLevel: 'Senior',
    technology: 'React & Node.js',
    interviewType: 'Technical',
    questionCount: 5
  };

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

  const testCases = [
    {
      name: 'TEST A (Gibberish Key Patterns)',
      answer: 'asdfghjkl qwertyuiop',
      expectedMax: 1
    },
    {
      name: 'TEST B (Unrelated Technical Buzzwords / Nonsense)',
      answer: 'MongoDB indexing chicken cloud memory corruption',
      expectedMax: 2
    },
    {
      name: 'TEST E (Prompt Case 1: Unrelated Memory/Schema Nonsense)',
      questionOverride: 'How do you profile, identify performance bottlenecks, and prevent memory leaks or redundant work in React & Node.js?',
      answer: 'we have fdesigned ouer schema according like that.we use the clod memory fo the corruiption',
      expectedMax: 2
    },
    {
      name: 'TEST F (Prompt Case 2: Unrelated Mongo/Chicken Nonsense)',
      questionOverride: 'What approach do you take for automated testing, error boundaries, and zero-downtime deployments in React & Node.js?',
      answer: 'indexing using mongo gay to the duty and keama chicken',
      expectedMax: 2
    },
    {
      name: 'TEST C (Incomplete Basic Answer)',
      answer: 'React is used for the frontend and Node.js can be used to create APIs.',
      expectedMin: 3,
      expectedMax: 5
    },
    {
      name: 'TEST D (Detailed Comprehensive Answer)',
      answer: 'React uses a component-based architecture where state and props determine the UI. I would minimize unnecessary renders using component composition, memoization where appropriate, stable references, lazy loading and code splitting. Node.js provides the backend API using its event-driven non-blocking I/O model.',
      expectedMin: 8
    }
  ];

  const results = [];

  for (const t of testCases) {
    console.log(`\n=================== ${t.name} ===================`);
    
    // Start session for test
    const { session, firstQuestion } = await startInterviewSession(user.id, config);

    if (t.questionOverride) {
      await prisma.interviewQuestion.update({
        where: { id: firstQuestion.id },
        data: { question: t.questionOverride }
      });
    }
    
    // Submit answer
    const submitResult = await submitQuestionAnswer(user.id, session.id, t.answer);
    const evalData = submitResult.evaluation;

    results.push({
      testName: t.name,
      answer: t.answer,
      score: evalData.score,
      technicalAccuracy: evalData.technicalAccuracy,
      communication: evalData.communication,
      relevance: evalData.relevance,
      feedback: evalData.feedback
    });
  }

  console.log('\n================ CALIBRATION SUMMARY RESULTS ================');
  results.forEach(r => {
    console.log(`\n📌 ${r.testName}:`);
    console.log(`   - Technical Accuracy: ${r.technicalAccuracy}/10`);
    console.log(`   - Communication: ${r.communication}/10`);
    console.log(`   - Relevance Score: ${r.relevance}/10`);
    console.log(`   - Final Persisted Score: ${r.score}/10`);
    console.log(`   - Feedback: "${r.feedback}"`);
  });

  const [tA, tB, tE, tF, tC, tD] = results;

  console.log('\n================ CALIBRATION ASSERTIONS ================');
  console.log(`Test A Gibberish (<= 1/10): ${tA.score <= 1 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tA.score}/10)`);
  console.log(`Test B Unrelated Buzzwords (<= 2/10): ${tB.score <= 2 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tB.score}/10)`);
  console.log(`Test E Prompt Case 1 Nonsense (<= 2/10): ${tE.score <= 2 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tE.score}/10)`);
  console.log(`Test F Prompt Case 2 Nonsense (<= 2/10): ${tF.score <= 2 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tF.score}/10)`);
  console.log(`Test C Incomplete Basic (3-5/10): ${(tC.score >= 3 && tC.score <= 5) ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tC.score}/10)`);
  console.log(`Test D Detailed Technical (>= 8/10): ${tD.score >= 8 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tD.score}/10)`);
  console.log(`Strict Relative Order (Score A < B <= C < D): ${(tA.score < tC.score && tB.score < tC.score && tC.score < tD.score) ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('=======================================================\n');

  await prisma.$disconnect();
}

testControlledScoringCalibration().catch(console.error);
