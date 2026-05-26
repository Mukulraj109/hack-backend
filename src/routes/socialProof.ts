import { Router } from 'express';
import * as socialProofController from '../controllers/socialProofController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { hackerAuth, hackerWrite } from '../middleware/hackathonAuth.js';

const router = Router();

router.get('/', ...hackerAuth, socialProofController.getProofs);
router.get('/all', authenticate, requireAdmin, socialProofController.getAllProofs);

router.post(
  '/',
  ...hackerWrite,
  validate(socialProofController.submitProofSchema),
  socialProofController.submitProof
);

router.put(
  '/:id/verify',
  authenticate,
  requireAdmin,
  validate(socialProofController.verifyProofSchema),
  socialProofController.verifyProof
);

export default router;
