import { Router } from 'express';
import * as hackathonSessionController from '../controllers/hackathonSessionController.js';
import {
  validateAuth0Token,
  loadHackathonUser,
} from '../middleware/hackathonAuth.js';

const router = Router();

router.get('/me', validateAuth0Token, loadHackathonUser, hackathonSessionController.getMe);

export default router;
