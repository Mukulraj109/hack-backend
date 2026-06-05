import { Router } from 'express';
import * as hackathonSessionController from '../controllers/hackathonSessionController.js';
import * as registrationFormController from '../controllers/registrationFormController.js';
import * as followFormController from '../controllers/followFormController.js';
import * as hiringPartnerFormController from '../controllers/hiringPartnerFormController.js';
import * as infoSessionFormController from '../controllers/infoSessionFormController.js';
import * as socialShareFormController from '../controllers/socialShareFormController.js';
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
router.get('/follow-form/access', followFormController.getFollowFormAccess);
router.get('/follow-form/view', followFormController.viewFollowForm);
router.all('/follow-form/p/:embedToken/*', followFormController.proxyFollowFormAsset);
router.get('/hiring-partner-form/access', hiringPartnerFormController.getHiringPartnerFormAccess);
router.get('/hiring-partner-form/view', hiringPartnerFormController.viewHiringPartnerForm);
router.all('/hiring-partner-form/p/:embedToken/*', hiringPartnerFormController.proxyHiringPartnerFormAsset);
router.get('/info-session-form/access', infoSessionFormController.getInfoSessionFormAccess);
router.get('/info-session-form/view', infoSessionFormController.viewInfoSessionForm);
router.all('/info-session-form/p/:embedToken/*', infoSessionFormController.proxyInfoSessionFormAsset);
router.get('/social-share-form/access', socialShareFormController.getSocialShareFormAccess);
router.get('/social-share-form/view', socialShareFormController.viewSocialShareForm);
router.all('/social-share-form/p/:embedToken/*', socialShareFormController.proxySocialShareFormAsset);
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
