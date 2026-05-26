import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { hackerAuth, hackerWrite } from '../middleware/hackathonAuth.js';

const router = Router();

router.get('/', taskController.getTasks);
router.get('/progress', ...hackerAuth, taskController.getTaskProgress);

router.post(
  '/:id/submit',
  ...hackerWrite,
  validate(taskController.submitTaskSchema),
  taskController.submitTask
);

router.put(
  '/:id/verify',
  authenticate,
  requireAdmin,
  validate(taskController.verifyTaskSchema),
  taskController.verifyTask
);

router.get('/admin/all', authenticate, requireAdmin, taskController.getAllTaskProgress);

export default router;
