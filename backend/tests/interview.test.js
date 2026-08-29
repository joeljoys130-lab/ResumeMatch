import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { isDuplicateQuestion } from '../src/services/interviewService.js';

describe('AI Interview Feature Integration Tests', () => {
  let authToken = '';
  let testUser = null;
  let sessionId = null;

  beforeAll(async () => {
    // Create test user and obtain auth token
    const loginRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Interview Test User',
        email: `interview_signup_${Date.now()}@example.com`,
        password: 'Password123!'
      });

    authToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'interview_' } }
    });
    await prisma.$disconnect();
  });

  describe('isDuplicateQuestion Helper', () => {
    test('Should return true for identical questions', () => {
      const q1 = 'How would you handle asynchronous state updates or error boundaries in React & Node.js?';
      const q2 = 'How would you handle asynchronous state updates or error boundaries in React & Node.js?';
      expect(isDuplicateQuestion(q2, [q1])).toBe(true);
    });

    test('Should return true for substantially similar questions', () => {
      const q1 = 'Explain how you handle asynchronous state updates and error boundaries in React.';
      const q2 = 'How do you handle async state updates and error boundaries in React application?';
      expect(isDuplicateQuestion(q2, [q1])).toBe(true);
    });

    test('Should return false for distinctly different questions', () => {
      const q1 = 'Can you explain the core architecture of React & Node.js application?';
      const q2 = 'How do you profile, identify performance bottlenecks, and prevent memory leaks?';
      expect(isDuplicateQuestion(q2, [q1])).toBe(false);
    });
  });

  describe('Full 5-Turn Interview Flow & Math Consistency', () => {
    test('1. Start session - Should return ACTIVE session with first question', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Full Stack Developer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical',
          questionCount: 5
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session).toHaveProperty('id');
      expect(res.body.data.firstQuestion.questionNumber).toBe(1);
      expect(typeof res.body.data.firstQuestion.question).toBe('string');

      sessionId = res.body.data.session.id;
    });

    test('2. Conduct 5 turns - Should generate 5 distinct questions and 0-10 sub-scores', async () => {
      const answers = [
        'I structure React apps using functional components, custom hooks for state management, and Node.js Express controllers for clean separation of concerns.',
        'I handle async operations using async/await, try/catch blocks, Zod schema validation, and custom Express error handling middleware.',
        'I profile Node.js apps using Chrome DevTools and clinic.js. In React, I use React.memo, useCallback, and useMemo to eliminate unnecessary re-renders.',
        'I write comprehensive Jest unit tests, Supertest API integration tests, and implement React ErrorBoundary components for graceful UI error fallback.',
        'I configure Docker containerization and setup Nginx reverse proxy with Redis caching for production scalability.'
      ];

      const questionTexts = [];

      for (let turn = 1; turn <= 5; turn++) {
        // Fetch current session to read unanswered question
        const sessionRes = await request(app)
          .get(`/api/interviews/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`);

        const currentUnanswered = sessionRes.body.data.session.questions.find(q => !q.userAnswer);
        expect(currentUnanswered).toBeDefined();
        expect(currentUnanswered.questionNumber).toBe(turn);

        // Verify question text is unique compared to previous turns
        expect(questionTexts).not.toContain(currentUnanswered.question);
        questionTexts.push(currentUnanswered.question);

        // Submit answer for current turn
        const answerRes = await request(app)
          .post(`/api/interviews/${sessionId}/answer`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ answer: answers[turn - 1] });

        expect(answerRes.statusCode).toBe(200);
        expect(answerRes.body.success).toBe(true);
        expect(answerRes.body.data.updatedQuestion.score).toBeGreaterThanOrEqual(0);
        expect(answerRes.body.data.updatedQuestion.score).toBeLessThanOrEqual(10);
        expect(answerRes.body.data.updatedQuestion.technicalAccuracy).toBeGreaterThanOrEqual(0);
        expect(answerRes.body.data.updatedQuestion.technicalAccuracy).toBeLessThanOrEqual(10);
        expect(answerRes.body.data.updatedQuestion.communication).toBeGreaterThanOrEqual(0);
        expect(answerRes.body.data.updatedQuestion.communication).toBeLessThanOrEqual(10);

        if (turn < 5) {
          expect(answerRes.body.data.completed).toBe(false);
          expect(answerRes.body.data.nextQuestion).toBeDefined();
          expect(answerRes.body.data.nextQuestion.questionNumber).toBe(turn + 1);
        } else {
          expect(answerRes.body.data.completed).toBe(true);
        }
      }

      // Assert all 5 questions generated in the session are strictly unique
      const uniqueQuestions = new Set(questionTexts);
      expect(uniqueQuestions.size).toBe(5);
    });

    test('3. Finalize interview - Overall score must equal Math.round(average_turn_score * 10) and report must display it', async () => {
      // Fetch session details to calculate exact expected score
      const sessionBeforeFinalize = await request(app)
        .get(`/api/interviews/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const questions = sessionBeforeFinalize.body.data.session.questions;
      const turnScores = questions.map(q => q.score);
      const avgScore = turnScores.reduce((a, b) => a + b, 0) / turnScores.length;
      const expectedOverallScore = Math.round(avgScore * 10);

      // Finalize session
      const finalizeRes = await request(app)
        .post(`/api/interviews/${sessionId}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalizeRes.statusCode).toBe(200);
      expect(finalizeRes.body.success).toBe(true);

      const completedSession = finalizeRes.body.data.session;
      expect(completedSession.status).toBe('COMPLETED');
      expect(completedSession.overallScore).toBe(expectedOverallScore);

      // Verify report contains exact calculated score string (e.g. "Overall Score: 78/100")
      const finalReport = finalizeRes.body.data.finalReport;
      expect(finalReport).toContain(`Overall Score:** ${expectedOverallScore}/100`);
    });
  });

  describe('Answer Quality & Scoring Calibration (No Hardcoded 4/10 Floor)', () => {
    test('Meaningless gibberish answer should receive low score (<= 1/10) with explicit feedback', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Full Stack Developer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      const sessId = startRes.body.data.session.id;

      const evalRes = await request(app)
        .post(`/api/interviews/${sessId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answer: 'asdfghjkl qwertyuiop' });

      expect(evalRes.statusCode).toBe(200);
      const updatedQ = evalRes.body.data.updatedQuestion;
      expect(updatedQ.userAnswer).toBe('asdfghjkl qwertyuiop');
      expect(updatedQ.score).toBeLessThanOrEqual(1);
      expect(updatedQ.technicalAccuracy).toBeLessThanOrEqual(1);
      expect(updatedQ.feedback.toLowerCase()).toContain('key pattern');
    });

    test('Contradictory architectural answer must receive low score (<= 2/10)', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Senior Engineer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      const sessId = startRes.body.data.session.id;

      const evalRes = await request(app)
        .post(`/api/interviews/${sessId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answer: "I don't follow architectural principles. I prefer one giant component and tightly coupled frontend and backend. I don't worry about scalability, security, validation, caching or error handling." });

      expect(evalRes.statusCode).toBe(200);
      expect(evalRes.body.data.updatedQuestion.score).toBeLessThanOrEqual(2);
      expect(evalRes.body.data.evaluation.relevance).toBeLessThanOrEqual(2);
    });

    test('TEST A: Generic tech paragraph on State Transitions must receive low score (<= 3/10)', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Senior Engineer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      const sessId = startRes.body.data.session.id;
      const qId = startRes.body.data.firstQuestion.id;

      await prisma.interviewQuestion.update({
        where: { id: qId },
        data: { question: 'How do you manage state transitions, data validation, and asynchronous side effects in React & Node.js?' }
      });

      const genericParagraph = 'React components communicate through props while Node.js handles API requests, MongoDB stores application data, Redis improves caching performance, Docker manages isolated services, Kubernetes coordinates containers, PostgreSQL indexes speed up queries, JWT handles authentication, and asynchronous promises connect the frontend and backend.';

      const evalRes = await request(app)
        .post(`/api/interviews/${sessId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answer: genericParagraph });

      expect(evalRes.statusCode).toBe(200);
      expect(evalRes.body.data.updatedQuestion.score).toBeLessThanOrEqual(3);
    });

    test('TEST B: Generic tech paragraph on Testing/Deployments must receive low score (<= 3/10)', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Senior Engineer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      const sessId = startRes.body.data.session.id;
      const qId = startRes.body.data.firstQuestion.id;

      await prisma.interviewQuestion.update({
        where: { id: qId },
        data: { question: 'What approach do you take for automated testing, error boundaries, and zero-downtime deployments in React & Node.js?' }
      });

      const genericParagraph = 'React components communicate through props while Node.js handles API requests, MongoDB stores application data, Redis improves caching performance, Docker manages isolated services, Kubernetes coordinates containers, PostgreSQL indexes speed up queries, JWT handles authentication, and asynchronous promises connect the frontend and backend.';

      const evalRes = await request(app)
        .post(`/api/interviews/${sessId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answer: genericParagraph });

      expect(evalRes.statusCode).toBe(200);
      expect(evalRes.body.data.updatedQuestion.score).toBeLessThanOrEqual(3);
    });

    test('TEST C: Generic tech paragraph on Architecture must receive low score (<= 3/10)', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Senior Engineer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      const sessId = startRes.body.data.session.id;
      const qId = startRes.body.data.firstQuestion.id;

      await prisma.interviewQuestion.update({
        where: { id: qId },
        data: { question: 'What are the essential architectural principles you follow when starting a new React & Node.js project for scale?' }
      });

      const genericParagraph = 'React components communicate through props while Node.js handles API requests, MongoDB stores application data, Redis improves caching performance, Docker manages isolated services, Kubernetes coordinates containers, PostgreSQL indexes speed up queries, JWT handles authentication, and asynchronous promises connect the frontend and backend.';

      const evalRes = await request(app)
        .post(`/api/interviews/${sessId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answer: genericParagraph });

      expect(evalRes.statusCode).toBe(200);
      expect(evalRes.body.data.updatedQuestion.score).toBeLessThanOrEqual(3);
    });

    test('TEST D: Detailed explanation on State Transitions must receive high score (>= 8/10)', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Senior Engineer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      const sessId = startRes.body.data.session.id;
      const qId = startRes.body.data.firstQuestion.id;

      await prisma.interviewQuestion.update({
        where: { id: qId },
        data: { question: 'How do you manage state transitions, data validation, and asynchronous side effects in React & Node.js?' }
      });

      const detailedAnswer = 'In React, I use useState for simple component state and useReducer for complex state transitions to make state changes explicit through actions. I validate all user input on the client using Zod schemas for immediate feedback, and re-validate on the Node.js backend using middleware before processing. I handle asynchronous operations using async/await with explicit loading, success, and error states to maintain predictable UI state.';

      const evalRes = await request(app)
        .post(`/api/interviews/${sessId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answer: detailedAnswer });

      expect(evalRes.statusCode).toBe(200);
      expect(evalRes.body.data.updatedQuestion.score).toBeGreaterThanOrEqual(8);
    });

    test('TEST E: Superficial answer on Profiling must receive low score (<= 3/10)', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Senior Engineer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      const sessId = startRes.body.data.session.id;
      const qId = startRes.body.data.firstQuestion.id;

      await prisma.interviewQuestion.update({
        where: { id: qId },
        data: { question: 'How do you profile, identify performance bottlenecks, and prevent memory leaks or redundant work in React & Node.js?' }
      });

      const evalRes = await request(app)
        .post(`/api/interviews/${sessId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answer: 'React uses components and Node.js handles APIs. Redis caches data and PostgreSQL stores records.' });

      expect(evalRes.statusCode).toBe(200);
      expect(evalRes.body.data.updatedQuestion.score).toBeLessThanOrEqual(3);
    });

    test('TEST F: Detailed answer on Profiling must receive high score (>= 8/10)', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Senior Engineer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      const sessId = startRes.body.data.session.id;
      const qId = startRes.body.data.firstQuestion.id;

      await prisma.interviewQuestion.update({
        where: { id: qId },
        data: { question: 'How do you profile, identify performance bottlenecks, and prevent memory leaks or redundant work in React & Node.js?' }
      });

      const detailedAnswer = 'I use the React DevTools Profiler to identify unnecessary re-renders and Chrome DevTools Performance tab to capture heap snapshots and memory leaks. In Node.js, I use node --inspect and clinic.js to profile event loop lag. I optimize rendering using React.memo, useMemo, and useCallback, and ensure event listeners and subscriptions are properly cleaned up in useEffect return functions.';

      const evalRes = await request(app)
        .post(`/api/interviews/${sessId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answer: detailedAnswer });

      expect(evalRes.statusCode).toBe(200);
      expect(evalRes.body.data.updatedQuestion.score).toBeGreaterThanOrEqual(8);
    });

    test('Score ordering must strictly follow answer quality: Gibberish < Unrelated < Buzzwords < Superficial < Detailed', async () => {
      const answers = [
        'qwrtyopojhvc cfghuiopoijh', // Gibberish (Test 1)
        'MongoDB indexing improves database query performance.', // Unrelated (Test 2)
        'MongoDB, Redis, Docker, Kubernetes, JWT, PostgreSQL, Prisma, API Gateway, indexing and caching.', // Buzzword dump (Test 3)
        'React manages state and Node.js handles APIs.', // Superficial (Test 4)
        'React uses a component-based architecture where state and props determine the UI. I would minimize unnecessary renders using component composition, memoization where appropriate, stable references, lazy loading and code splitting. Node.js provides the backend API using its event-driven non-blocking I/O model.' // Detailed (Test 5)
      ];

      const scores = [];

      for (let i = 0; i < answers.length; i++) {
        const startRes = await request(app)
          .post('/api/interviews')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            role: 'Senior Engineer',
            experienceLevel: 'Senior',
            technology: 'React & Node.js',
            interviewType: 'Technical',
            questionCount: 5
          });

        const sessId = startRes.body.data.session.id;
        const qId = startRes.body.data.firstQuestion.id;

        if (i === 3) {
          await prisma.interviewQuestion.update({
            where: { id: qId },
            data: { question: 'How do you manage state transitions, data validation, and asynchronous side effects in React & Node.js?' }
          });
        } else if (i === 4) {
          await prisma.interviewQuestion.update({
            where: { id: qId },
            data: { question: 'What are the essential architectural principles you follow when starting a new React & Node.js project for scale?' }
          });
        }

        const evalRes = await request(app)
          .post(`/api/interviews/${sessId}/answer`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ answer: answers[i] });

        scores.push(evalRes.body.data.updatedQuestion.score);
      }

      // Assert strict score calibration ordering
      expect(scores[0]).toBeLessThanOrEqual(1); // Gibberish <= 1/10
      expect(scores[1]).toBeLessThanOrEqual(2); // Unrelated <= 2/10
      expect(scores[2]).toBeLessThanOrEqual(2); // Buzzword dump <= 2/10
      expect(scores[3]).toBeLessThanOrEqual(5); // Superficial <= 5/10
      expect(scores[4]).toBeGreaterThanOrEqual(8); // Detailed >= 8/10

      expect(scores[0]).toBeLessThan(scores[3]);
      expect(scores[1]).toBeLessThan(scores[3]);
      expect(scores[2]).toBeLessThan(scores[4]);
      expect(scores[3]).toBeLessThan(scores[4]);
    });
  });

  describe('User-Selectable Question Count & State Progression (5, 10, 15 Questions)', () => {
    test('Should default to 5 questions when questionCount is omitted', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Full Stack Developer',
          experienceLevel: 'Mid-Level',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.session.questionCount).toBe(5);
    });

    test('Should persist selected questionCount (10 questions)', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Full Stack Developer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical',
          questionCount: 10
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.session.questionCount).toBe(10);
    });

    test('Should reject invalid questionCount values (not 5, 10, or 15)', async () => {
      const res1 = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Developer',
          experienceLevel: 'Senior',
          technology: 'Node.js',
          interviewType: 'Technical',
          questionCount: 7
        });

      expect(res1.statusCode).toBe(400);

      const res2 = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Developer',
          experienceLevel: 'Senior',
          technology: 'Node.js',
          interviewType: 'Technical',
          questionCount: 25
        });

      expect(res2.statusCode).toBe(400);
    });

    test('10-Question Session - Should NOT finalize at turn 4, must complete exactly at turn 10', async () => {
      const startRes = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Staff Engineer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical',
          questionCount: 10
        });

      const sessId = startRes.body.data.session.id;

      const sampleAnswer = 'I build modular React apps using clean functional components, custom hooks, and Express REST APIs.';

      for (let turn = 1; turn <= 10; turn++) {
        const answerRes = await request(app)
          .post(`/api/interviews/${sessId}/answer`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ answer: `${sampleAnswer} (Turn ${turn})` });

        expect(answerRes.statusCode).toBe(200);

        if (turn < 10) {
          expect(answerRes.body.data.completed).toBe(false);
          expect(answerRes.body.data.nextQuestion).toBeDefined();
          expect(answerRes.body.data.nextQuestion.questionNumber).toBe(turn + 1);
        } else {
          expect(answerRes.body.data.completed).toBe(true);
        }
      }

      // Finalize session and verify overall score math
      const finalizeRes = await request(app)
        .post(`/api/interviews/${sessId}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalizeRes.statusCode).toBe(200);
      expect(finalizeRes.body.data.session.status).toBe('COMPLETED');
      expect(finalizeRes.body.data.answeredCount).toBe(10);
    });
  });
});


