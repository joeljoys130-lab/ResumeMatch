import { Router } from 'express';
import {
  startInterview,
  submitAnswer,
  getSessionById,
  completeInterview,
  listInterviews
} from '../controllers/interviewController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { startInterviewSchema, submitInterviewAnswerSchema } from '../utils/validators.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(authenticate);

router.post('/', aiLimiter, validate(startInterviewSchema), startInterview);
router.get('/', listInterviews);
router.get('/:id', getSessionById);
router.post('/:id/answer', aiLimiter, validate(submitInterviewAnswerSchema), submitAnswer);
router.post('/:id/complete', completeInterview);

export default router;
