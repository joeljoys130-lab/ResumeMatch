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

  const genericTechParagraph = "React components communicate through props while Node.js handles API requests, MongoDB stores application data, Redis improves caching performance, Docker manages isolated services, Kubernetes coordinates containers, PostgreSQL indexes speed up queries, JWT handles authentication, and asynchronous promises connect the frontend and backend.";

  const testCases = [
    {
      name: 'TEST A (State Transitions + Generic Tech Paragraph)',
      questionOverride: 'How do you manage state transitions, data validation, and asynchronous side effects in React & Node.js?',
      answer: genericTechParagraph,
      expectedMax: 3
    },
    {
      name: 'TEST B (Automated Testing + Generic Tech Paragraph)',
      questionOverride: 'What approach do you take for automated testing, error boundaries, and zero-downtime deployments in React & Node.js?',
      answer: genericTechParagraph,
      expectedMax: 3
    },
    {
      name: 'TEST C (Scalable Architecture + Generic Tech Paragraph)',
      questionOverride: 'What are the essential architectural principles you follow when starting a new React & Node.js project for scale?',
      answer: genericTechParagraph,
      expectedMax: 3
    },
    {
      name: 'TEST D (State Transitions + Detailed Explanation)',
      questionOverride: 'How do you manage state transitions, data validation, and asynchronous side effects in React & Node.js?',
      answer: 'In React, I use useState for simple component state and useReducer for complex state transitions to make state changes explicit through actions. I validate all user input on the client using Zod schemas for immediate feedback, and re-validate on the Node.js backend using middleware before processing. I handle asynchronous operations using async/await with explicit loading, success, and error states to maintain predictable UI state.',
      expectedMin: 8
    },
    {
      name: 'TEST E (Profiling + Superficial Answer)',
      questionOverride: 'How do you profile, identify performance bottlenecks, and prevent memory leaks or redundant work in React & Node.js?',
      answer: 'React uses components and Node.js handles APIs. Redis caches data and PostgreSQL stores records.',
      expectedMax: 3
    },
    {
      name: 'TEST F (Profiling + Detailed Answer)',
      questionOverride: 'How do you profile, identify performance bottlenecks, and prevent memory leaks or redundant work in React & Node.js?',
      answer: 'I use the React DevTools Profiler to identify unnecessary re-renders and Chrome DevTools Performance tab to capture heap snapshots and memory leaks. In Node.js, I use node --inspect and clinic.js to profile event loop lag. I optimize rendering using React.memo, useMemo, and useCallback, and ensure event listeners and subscriptions are properly cleaned up in useEffect return functions.',
      expectedMin: 8
    },
    {
      name: 'TEST G (Gibberish Key Patterns)',
      questionOverride: 'How do you prevent memory leaks in React?',
      answer: 'asdfghjkl qwertyuiop',
      expectedMax: 1
    },
    {
      name: 'TEST H (Contradictory / Anti-Pattern Answer)',
      questionOverride: 'What are the essential architectural principles you follow when starting a new React & Node.js project for scale?',
      answer: "I don't follow architectural principles. I prefer one giant component and tightly coupled frontend and backend. I don't worry about scalability, security, validation, caching or error handling.",
      expectedMax: 2
    },
    {
      name: 'TEST I (Typo Tolerance Answer)',
      questionOverride: 'How do you optimize React rendering?',
      answer: 'I use memoization to stop unecessary rerenders and lazy loading to reduce the initial bundle size. I also avoid changing state unnecessarily.',
      expectedMin: 7
    }
  ];

  const results = [];

  for (const t of testCases) {
    const { session, firstQuestion } = await startInterviewSession(user.id, config);

    if (t.questionOverride) {
      await prisma.interviewQuestion.update({
        where: { id: firstQuestion.id },
        data: { question: t.questionOverride }
      });
    }
    
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

  const [tA, tB, tC, tD, tE, tF, tG, tH, tI] = results;

  console.log('\n================ CALIBRATION ASSERTIONS ================');
  console.log(`Test A (State + Generic Dump <= 3): ${tA.score <= 3 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tA.score}/10)`);
  console.log(`Test B (Testing + Generic Dump <= 3): ${tB.score <= 3 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tB.score}/10)`);
  console.log(`Test C (Architecture + Generic Dump <= 3): ${tC.score <= 3 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tC.score}/10)`);
  console.log(`Test D (State + Detailed >= 8): ${tD.score >= 8 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tD.score}/10)`);
  console.log(`Test E (Profiling + Superficial <= 3): ${tE.score <= 3 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tE.score}/10)`);
  console.log(`Test F (Profiling + Detailed >= 8): ${tF.score >= 8 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tF.score}/10)`);
  console.log(`Test G (Gibberish <= 1): ${tG.score <= 1 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tG.score}/10)`);
  console.log(`Test H (Contradictory <= 2): ${tH.score <= 2 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tH.score}/10)`);
  console.log(`Test I (Typo Tolerance >= 7): ${tI.score >= 7 ? 'PASS ✅' : 'FAIL ❌'} (Got: ${tI.score}/10)`);

  console.log('\n================ RELATIVE ORDERING ASSERTIONS ================');
  console.log(`Gibberish < Buzzword Dump (tG < tA): ${tG.score < tA.score ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Buzzword Dump <= Shallow (tA <= tE): ${tA.score <= tE.score ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Shallow < Detailed (tE < tD): ${tE.score < tD.score ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Contradictory < Detailed (tH < tF): ${tH.score < tF.score ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('=======================================================\n');

  await prisma.$disconnect();
}

testControlledScoringCalibration().catch(console.error);
