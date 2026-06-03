import { Router } from 'express';
import * as socialProofController from '../controllers/socialProofController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/all', authenticate, requireAdmin, socialProofController.getAllProofs);

router.put(
  '/:id/verify',
  authenticate,
  requireAdmin,
  validate(socialProofController.verifyProofSchema),
  socialProofController.verifyProof
);

export default router;
