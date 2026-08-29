import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { startInterviewSession, submitQuestionAnswer, finalizeInterviewSession } from '../src/services/interviewService.js';
import prisma from '../src/config/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testControlledScoringCalibration() {
  console.log('🧪 Starting Controlled 3-Answer Scoring Calibration Test...\n');

  const config = {
    role: 'Senior Full Stack Engineer',
    experienceLevel: 'Senior',
    technology: 'React & Node.js',
    interviewType: 'Technical'
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

  const testAnswers = [
    { name: 'TEST 1 (Gibberish Input)', text: 'asdfghjkl qwertyuiop' },
    { name: 'TEST 2 (Incomplete Basic Answer)', text: 'React is used for the frontend and Node.js can be used to create APIs.' },
    { name: 'TEST 3 (Detailed Comprehensive Answer)', text: 'React uses a component-based architecture where state and props determine the UI. I would minimize unnecessary renders using component composition, memoization where appropriate, stable references, lazy loading and code splitting. Node.js provides the backend API using its event-driven non-blocking I/O model.' }
  ];

  const results = [];

  for (let i = 0; i < testAnswers.length; i++) {
    const t = testAnswers[i];
    console.log(`\n=================== ${t.name} ===================`);
    
    // Start session for test
    const { session, firstQuestion } = await startInterviewSession(user.id, config);
    
    // Submit answer
    const submitResult = await submitQuestionAnswer(user.id, session.id, t.text);
    const evalData = submitResult.evaluation;

    results.push({
      testName: t.name,
      answer: t.text,
      score: evalData.score,
      technicalAccuracy: evalData.technicalAccuracy,
      communication: evalData.communication,
      feedback: evalData.feedback
    });
  }

  console.log('\n================ CALIBRATION SUMMARY RESULTS ================');
  results.forEach(r => {
    console.log(`\n📌 ${r.testName}:`);
    console.log(`   - Technical Accuracy: ${r.technicalAccuracy}/10`);
    console.log(`   - Communication: ${r.communication}/10`);
    console.log(`   - Final Score: ${r.score}/10`);
    console.log(`   - Feedback: "${r.feedback}"`);
  });

  const [t1, t2, t3] = results;

  console.log('\n================ CALIBRATION ASSERTIONS ================');
  console.log(`Test 1 Gibberish Low Score (<= 1/10): ${t1.score <= 1 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${t1.score}/10)`);
  console.log(`Test 2 Incomplete Moderate Score (3-5/10): ${(t2.score >= 3 && t2.score <= 5) ? 'PASS ✅' : 'FAIL ❌'} (Got: ${t2.score}/10)`);
  console.log(`Test 3 Detailed High Score (>= 8/10): ${t3.score >= 8 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${t3.score}/10)`);
  console.log(`Strict Relative Order (Score T1 < Score T2 < Score T3): ${(t1.score < t2.score && t2.score < t3.score) ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('=======================================================\n');

  await prisma.$disconnect();
}

testControlledScoringCalibration().catch(console.error);
