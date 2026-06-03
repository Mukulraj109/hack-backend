import { Router } from 'express';
import * as assetProxyController from '../controllers/assetProxyController.js';

const router = Router();

router.get('/proxy', assetProxyController.proxyImage);

export default router;
