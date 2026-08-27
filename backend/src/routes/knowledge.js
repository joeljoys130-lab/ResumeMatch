import { Router } from 'express';
import { queryKnowledge, streamKnowledge, seedKnowledge } from '../controllers/knowledgeController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ragQuerySchema } from '../utils/validators.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { requireRole } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);

router.post('/query', aiLimiter, validate(ragQuerySchema), queryKnowledge);
router.get('/stream', streamKnowledge);
router.post('/seed', requireRole('ADMIN'), seedKnowledge);

export default router;
