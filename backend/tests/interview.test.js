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

  describe('Full 4-Turn Interview Flow & Math Consistency', () => {
    test('1. Start session - Should return ACTIVE session with first question', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Full Stack Developer',
          experienceLevel: 'Senior',
          technology: 'React & Node.js',
          interviewType: 'Technical'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session).toHaveProperty('id');
      expect(res.body.data.firstQuestion.questionNumber).toBe(1);
      expect(typeof res.body.data.firstQuestion.question).toBe('string');

      sessionId = res.body.data.session.id;
    });

    test('2. Conduct 4 turns - Should generate 4 distinct questions and 0-10 sub-scores', async () => {
      const answers = [
        'I structure React apps using functional components, custom hooks for state management, and Node.js Express controllers for clean separation of concerns.',
        'I handle async operations using async/await, try/catch blocks, Zod schema validation, and custom Express error handling middleware.',
        'I profile Node.js apps using Chrome DevTools and clinic.js. In React, I use React.memo, useCallback, and useMemo to eliminate unnecessary re-renders.',
        'I write comprehensive Jest unit tests, Supertest API integration tests, and implement React ErrorBoundary components for graceful UI error fallback.'
      ];

      const questionTexts = [];

      for (let turn = 1; turn <= 4; turn++) {
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

        if (turn < 4) {
          expect(answerRes.body.data.completed).toBe(false);
          expect(answerRes.body.data.nextQuestion).toBeDefined();
          expect(answerRes.body.data.nextQuestion.questionNumber).toBe(turn + 1);
        } else {
          expect(answerRes.body.data.completed).toBe(true);
        }
      }

      // Assert all 4 questions generated in the session are strictly unique
      const uniqueQuestions = new Set(questionTexts);
      expect(uniqueQuestions.size).toBe(4);
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
      expect(updatedQ.technicalAccuracy).toBe(0);
      expect(updatedQ.feedback.toLowerCase()).toContain('random key patterns');
    });

    test('Score ordering must strictly follow answer quality: Gibberish < Superficial < Detailed', async () => {
      const answers = [
        'qwrtyopojhvc cfghuiopoijh', // Gibberish (Test 1)
        'React is used for the frontend and Node.js can be used to create APIs.', // Incomplete (Test 2)
        'React uses a component-based architecture where state and props determine the UI. I would minimize unnecessary renders using component composition, memoization where appropriate, stable references, lazy loading and code splitting. Node.js provides the backend API using its event-driven non-blocking I/O model.' // Detailed (Test 3)
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
            interviewType: 'Technical'
          });

        const sessId = startRes.body.data.session.id;
        const evalRes = await request(app)
          .post(`/api/interviews/${sessId}/answer`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ answer: answers[i] });

        scores.push(evalRes.body.data.updatedQuestion.score);
      }

      // Assert strict score calibration ordering
      expect(scores[0]).toBeLessThanOrEqual(1); // Test 1 Gibberish <= 1/10
      expect(scores[1]).toBeGreaterThanOrEqual(3); // Test 2 Basic >= 3/10
      expect(scores[1]).toBeLessThanOrEqual(5); // Test 2 Basic <= 5/10
      expect(scores[2]).toBeGreaterThanOrEqual(8); // Test 3 Detailed >= 8/10

      expect(scores[0]).toBeLessThan(scores[1]);
      expect(scores[1]).toBeLessThan(scores[2]);
    });
  });
});

