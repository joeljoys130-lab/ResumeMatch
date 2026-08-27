import { Router } from 'express';
import { getAdminAnalytics, getLLMUsageMetrics, getUserAnalytics } from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);

// User-facing personal stats
router.get('/user-analytics', getUserAnalytics);

// Admin-restricted routes
router.get('/analytics', requireRole('ADMIN'), getAdminAnalytics);
router.get('/llm-usage', requireRole('ADMIN'), getLLMUsageMetrics);

export default router;
