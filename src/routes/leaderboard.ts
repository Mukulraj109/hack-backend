import { Router } from 'express';
import * as leaderboardController from '../controllers/leaderboardController.js';
import { hackerAuth, optionalHackathonAuth } from '../middleware/hackathonAuth.js';

const router = Router();

router.get('/', optionalHackathonAuth, leaderboardController.getLeaderboard);
router.get('/top/:count', leaderboardController.getTopTeams);
router.get('/me', ...hackerAuth, leaderboardController.getUserRank);

export default router;
