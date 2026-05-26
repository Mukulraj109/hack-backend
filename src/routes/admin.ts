import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin', 'judge'));

router.get('/users', adminController.getUsers);
router.get('/submissions', adminController.getSubmissions);
router.get('/dashboard', adminController.getDashboardStats);

router.put('/submissions/:id/status', adminController.updateSubmissionStatus);
router.put('/finalists', adminController.markFinalists);
router.put('/winners', adminController.markWinners);

router.post('/scores/:id', validate(adminController.scoreSubmissionSchema), adminController.scoreSubmission);

router.get('/config', adminController.getConfig);
router.put('/config', validate(adminController.updateConfigSchema), adminController.updateConfig);

export default router;
