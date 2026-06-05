import { Router } from 'express';
import * as zohoWebhookController from '../controllers/zohoWebhookController.js';

const router = Router();

router.post('/zoho/registration', zohoWebhookController.zohoRegistrationWebhook);
router.post('/zoho/social-proof', zohoWebhookController.zohoSocialProofWebhook);

export default router;
