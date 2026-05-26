import { Router } from 'express';
import * as zohoWebhookController from '../controllers/zohoWebhookController.js';

const router = Router();

router.post('/zoho/registration', zohoWebhookController.zohoRegistrationWebhook);

export default router;
