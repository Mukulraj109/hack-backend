import { Router } from 'express';
import * as hackathonAdminController from '../controllers/hackathonAdminController.js';
import { hackerAdmin } from '../middleware/hackathonAuth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(...hackerAdmin);

router.get('/users', hackathonAdminController.getUsers);
router.get('/users/search', hackathonAdminController.searchUsers);
router.patch(
  '/users/:id/account-status',
  validate(hackathonAdminController.updateAccountStatusSchema),
  hackathonAdminController.updateAccountStatus
);
router.post(
  '/users/:id/points',
  validate(hackathonAdminController.addUserPointsSchema),
  hackathonAdminController.addUserPoints
);

router.get('/submissions', hackathonAdminController.getSubmissions);
router.get('/submissions/:id', hackathonAdminController.getSubmissionById);
router.put(
  '/submissions/:id/status',
  validate(hackathonAdminController.updateSubmissionStatusSchema),
  hackathonAdminController.updateSubmissionStatus
);
router.put(
  '/submissions/:id/judge-score',
  validate(hackathonAdminController.scoreSubmissionJudgeSchema),
  hackathonAdminController.scoreSubmissionJudge
);

router.get('/social-proofs', hackathonAdminController.getSocialProofs);
router.put(
  '/social-proofs/:id/verify',
  validate(hackathonAdminController.verifySocialProofSchema),
  hackathonAdminController.verifySocialProof
);

export default router;
