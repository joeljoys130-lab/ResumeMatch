import { Router } from 'express';
import { createAnalysis, listAnalyses, getAnalysisById, deleteAnalysis } from '../controllers/analysisController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadResumeMiddleware } from '../middleware/upload.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(authenticate);

router.post('/', aiLimiter, uploadResumeMiddleware, createAnalysis);
router.get('/', listAnalyses);
router.get('/:id', getAnalysisById);
router.delete('/:id', deleteAnalysis);

export default router;
