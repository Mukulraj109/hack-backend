import { Response } from 'express';
import { z } from 'zod';
import { User, Team, Submission, HackathonConfig, JudgeScore } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import * as leaderboardService from '../services/leaderboardService.js';
import * as pointsService from '../services/pointsService.js';

export const updateConfigSchema = z.object({
  name: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sprintHours: z.number().optional(),
  maxPoints: z.number().optional(),
  maxJudgePoints: z.number().optional(),
  maxSprintPoints: z.number().optional(),
  bonusPoints: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const scoreSubmissionSchema = z.object({
  innovationScore: z.number().min(1).max(50),
  executionScore: z.number().min(1).max(50),
  technicalScore: z.number().min(1).max(25),
  uxScore: z.number().min(1).max(25),
  feedback: z.string().optional(),
});

export const getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const users = await User.find()
    .select('-passwordHash')
    .skip(skip)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  const total = await User.countDocuments();

  res.json({
    success: true,
    data: users,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

export const getSubmissions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, track } = req.query;
  const filter: any = {};

  if (status) filter.status = status;
  if (track) filter.track = track;

  const submissions = await Submission.find(filter)
    .populate('team', 'name track members')
    .sort({ submittedAt: -1 });

  res.json({
    success: true,
    data: submissions,
  });
});

export const updateSubmissionStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { id } = req.params;
  const { status } = req.body;

  const submission = await Submission.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  ).populate('team', 'name track members');

  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  res.json({
    success: true,
    data: submission,
  });
});

export const markFinalists = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { teamIds } = req.body;

  await Team.updateMany({}, { isFinalist: false });

  if (teamIds && teamIds.length > 0) {
    await Team.updateMany(
      { _id: { $in: teamIds } },
      { isFinalist: true }
    );
  }

  res.json({
    success: true,
    message: 'Finalists updated',
  });
});

export const markWinners = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { teamIds } = req.body;

  await Team.updateMany({}, { isWinner: false });

  if (teamIds && teamIds.length > 0) {
    await Team.updateMany(
      { _id: { $in: teamIds } },
      { isWinner: true }
    );
  }

  res.json({
    success: true,
    message: 'Winners updated',
  });
});

export const scoreSubmission = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'judge')) {
    throw ApiError.forbidden('Judge or admin access required');
  }

  const { id } = req.params;
  const { innovationScore, executionScore, technicalScore, uxScore, feedback } = req.body;

  const submission = await Submission.findById(id);
  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  let score = await JudgeScore.findOne({
    submission: id,
    judge: req.user.userId,
  });

  if (score) {
    score.innovationScore = innovationScore;
    score.executionScore = executionScore;
    score.technicalScore = technicalScore;
    score.uxScore = uxScore;
    score.totalScore = innovationScore + executionScore + technicalScore + uxScore;
    score.feedback = feedback;
  } else {
    score = await JudgeScore.create({
      submission: id,
      judge: req.user.userId,
      innovationScore,
      executionScore,
      technicalScore,
      uxScore,
      totalScore: innovationScore + executionScore + technicalScore + uxScore,
      feedback,
    });
  }

  await score.save();

  await submission.updateOne({ status: 'judged' });

  const team = await Team.findById(submission.team);
  if (team) {
    await pointsService.calculateTeamPoints(team._id.toString());
  }

  res.json({
    success: true,
    data: score,
  });
});

export const getConfig = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const config = await HackathonConfig.findOne({ isActive: true });

  res.json({
    success: true,
    data: config,
  });
});

export const updateConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const config = await HackathonConfig.findOneAndUpdate(
    { isActive: true },
    req.body,
    { new: true, upsert: true }
  );

  res.json({
    success: true,
    data: config,
  });
});

export const getDashboardStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const [userCount, teamCount, submissionCount, config] = await Promise.all([
    User.countDocuments(),
    Team.countDocuments(),
    Submission.countDocuments({ status: 'submitted' }),
    HackathonConfig.findOne({ isActive: true }),
  ]);

  const leaderboard = await leaderboardService.getLeaderboard();

  res.json({
    success: true,
    data: {
      userCount,
      teamCount,
      submissionCount,
      topTeams: leaderboard.leaderboard.slice(0, 10),
      config,
    },
  });
});
