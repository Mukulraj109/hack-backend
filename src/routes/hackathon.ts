import { Router } from 'express';
import * as hackathonSessionController from '../controllers/hackathonSessionController.js';
import * as registrationFormController from '../controllers/registrationFormController.js';
import {
  validateAuth0Token,
  loadHackathonUser,
  requireActiveAccount,
} from '../middleware/hackathonAuth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/me', validateAuth0Token, loadHackathonUser, hackathonSessionController.getMe);
router.get(
  '/me/registration-form/access',
  validateAuth0Token,
  loadHackathonUser,
  registrationFormController.getRegistrationFormAccess
);
router.get('/registration-form/view', registrationFormController.viewRegistrationForm);
router.all(
  '/registration-form/p/:embedToken/*',
  registrationFormController.proxyRegistrationFormAsset
);
router.get(
  '/me/points-breakdown',
  validateAuth0Token,
  loadHackathonUser,
  hackathonSessionController.getPointsBreakdownHandler
);
router.post(
  '/me/headshot',
  validateAuth0Token,
  loadHackathonUser,
  requireActiveAccount,
  hackathonSessionController.uploadHeadshotMiddleware,
  hackathonSessionController.uploadMyHeadshot
);

router.patch(
  '/me/career-profile',
  validateAuth0Token,
  loadHackathonUser,
  requireActiveAccount,
  validate(hackathonSessionController.careerProfileSchema),
  hackathonSessionController.updateCareerProfile
);

router.post(
  '/me/resume',
  validateAuth0Token,
  loadHackathonUser,
  requireActiveAccount,
  hackathonSessionController.uploadResumeMiddleware,
  hackathonSessionController.uploadMyResume
);

export default router;
