import { Router } from 'express';
import * as configController from '../controllers/configController.js';

const router = Router();

router.get('/', configController.getConfig);
router.get('/countdown', configController.getCountdown);
router.get('/tracks', configController.getTracks);
router.get('/social', configController.getSocial);

export default router;
