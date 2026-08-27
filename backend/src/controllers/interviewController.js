import prisma from '../config/prisma.js';
import {
  startInterviewSession,
  submitQuestionAnswer,
  finalizeInterviewSession
} from '../services/interviewService.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const startInterview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const config = req.body;

  const result = await startInterviewSession(userId, config);
  return sendSuccess(res, result, 201, 'AI Interview session started.');
});

export const submitAnswer = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sessionId = Number(req.params.id);
  const { answer } = req.body;

  const result = await submitQuestionAnswer(userId, sessionId, answer);
  return sendSuccess(res, result, 200, 'Answer evaluated successfully.');
});

export const getSessionById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sessionId = Number(req.params.id);

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      questions: { orderBy: { questionNumber: 'asc' } }
    }
  });

  if (!session) {
    throw new NotFoundError(`Interview session #${sessionId} not found.`);
  }

  return sendSuccess(res, { session });
});

export const completeInterview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sessionId = Number(req.params.id);

  const result = await finalizeInterviewSession(userId, sessionId);
  return sendSuccess(res, result, 200, 'Interview session completed.');
});

export const listInterviews = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const sessions = await prisma.interviewSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { questions: true } }
    }
  });

  return sendSuccess(res, { sessions });
});
