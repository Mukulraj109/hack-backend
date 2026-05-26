import { Response } from 'express';
import * as leaderboardService from '../services/leaderboardService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/express/index.js';

export const getLeaderboard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const result = await leaderboardService.getLeaderboard(userId);

  res.json({
    success: true,
    data: result,
  });
});

export const getTopTeams = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const count = parseInt(req.params.count) || 10;
  const teams = await leaderboardService.getTopTeams(count);

  res.json({
    success: true,
    data: teams,
  });
});

export const getUserRank = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.json({
      success: true,
      data: null,
    });
  }

  const rank = await leaderboardService.getUserRank(req.user.userId);

  res.json({
    success: true,
    data: rank,
  });
});
