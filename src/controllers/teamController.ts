import { Response } from 'express';
import { z } from 'zod';
import * as teamService from '../services/teamService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { Team } from '../models/index.js';

export const createTeamSchema = z.object({
  title: z.string().min(2, 'Team title is required'),
});

export const joinTeamSchema = z.object({
  inviteCode: z.string().min(1, 'Team ID is required'),
});

export const updateTeamSchema = z.object({
  title: z.string().min(2).optional(),
  track: z.enum(['ai-career-agent', 'recruiter-bridge', 'open-build']).optional(),
});

export const createTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const team = await teamService.createTeam({
    ...req.body,
    leaderId: req.user.userId,
  });

  res.status(201).json({
    success: true,
    data: team,
  });
});

export const joinTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { inviteCode } = req.body;
  const team = await teamService.joinTeam(inviteCode, req.user.userId);

  res.json({
    success: true,
    data: team,
    message: 'Successfully joined team',
  });
});

export const leaveTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { teamId } = req.params;
  await teamService.leaveTeam(teamId, req.user.userId);

  res.json({
    success: true,
    message: 'Successfully left team',
  });
});

export const removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { teamId, userId } = req.params;
  await teamService.removeMember(teamId, userId, req.user.userId);

  res.json({
    success: true,
    message: 'Member removed successfully',
  });
});

export const getTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const team = await teamService.getTeamById(id);

  if (!team) {
    throw ApiError.notFound('Team not found');
  }

  res.json({
    success: true,
    data: team,
  });
});

export const getTeamByInviteCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { inviteCode } = req.params;
  const team = await teamService.getTeamByInviteCode(inviteCode);

  if (!team) {
    throw ApiError.notFound('Team not found');
  }

  res.json({
    success: true,
    data: team,
  });
});

export const getAllTeams = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { track } = req.query;
  let teams;

  if (track) {
    teams = await teamService.getTeamsByTrack(track as string);
  } else {
    teams = await teamService.getAllTeams();
  }

  res.json({
    success: true,
    data: teams,
  });
});

export const getUserTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const team = await teamService.getUserTeam(req.user.userId);

  res.json({
    success: true,
    data: team,
  });
});

export const updateTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { id } = req.params;
  const team = await teamService.updateTeam(id, req.body, req.user.userId);

  res.json({
    success: true,
    data: team,
  });
});

export const getTeamMembers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const team = await Team.findById(id).populate('members', 'firstName lastName email linkedinUrl githubUrl universityName currentCompanyName');

  if (!team) {
    throw ApiError.notFound('Team not found');
  }

  res.json({
    success: true,
    data: team.members,
  });
});
