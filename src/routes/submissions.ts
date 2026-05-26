import { Router } from 'express';
import * as submissionController from '../controllers/submissionController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { hackerAuth, hackerWrite } from '../middleware/hackathonAuth.js';

const router = Router();

router.get('/', authenticate, requireAdmin, submissionController.getAllSubmissions);
router.get('/my', ...hackerAuth, submissionController.getMySubmission);
router.get('/:id', submissionController.getSubmission);

router.post(
  '/',
  ...hackerWrite,
  validate(submissionController.createSubmissionSchema),
  submissionController.createSubmission
);

router.put(
  '/:id',
  ...hackerWrite,
  validate(submissionController.updateSubmissionSchema),
  submissionController.updateSubmission
);

router.post(
  '/:id/upload',
  ...hackerWrite,
  submissionController.uploadMiddleware,
  submissionController.uploadFile
);

router.post('/:id/finalize', ...hackerWrite, submissionController.finalizeSubmission);

router.put(
  '/:id/status',
  authenticate,
  requireAdmin,
  submissionController.updateSubmissionStatus
);

export default router;
