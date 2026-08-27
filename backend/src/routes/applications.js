import { Router } from 'express';
import {
  createApplication,
  listApplications,
  getApplicationById,
  updateApplication,
  deleteApplication
} from '../controllers/applicationController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createApplicationSchema, updateApplicationSchema } from '../utils/validators.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createApplicationSchema), createApplication);
router.get('/', listApplications);
router.get('/:id', getApplicationById);
router.patch('/:id', validate(updateApplicationSchema), updateApplication);
router.delete('/:id', deleteApplication);

export default router;
