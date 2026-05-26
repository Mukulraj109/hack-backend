import { Router } from 'express';
import * as referralController from '../controllers/referralController.js';
import { hackerAuth } from '../middleware/hackathonAuth.js';

const router = Router();

router.get('/', ...hackerAuth, referralController.getReferrals);
router.get('/stats', ...hackerAuth, referralController.getReferralStats);
router.get('/invite-url', ...hackerAuth, referralController.getInviteUrl);
router.post('/track/:code', referralController.trackReferral);

export default router;
