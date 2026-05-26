import { Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { Referral, User } from '../models/index.js';

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name is required'),
  teamName: z.string().optional(),
  track: z.enum(['ai-career-agent', 'recruiter-bridge', 'open-build']).optional(),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const input = req.body;

  const result = await authService.register(input);

  if (input.referralCode) {
    const referrer = await User.findOne({ referralCode: input.referralCode.toUpperCase() });
    if (referrer) {
      await Referral.create({
        referrer: referrer._id,
        referee: result.user._id,
        refereeEmail: result.user.email,
        referralCode: input.referralCode.toUpperCase(),
        status: 'registered',
        registeredAt: new Date(),
      });
    }
  }

  res.status(201).json({
    success: true,
    data: {
      user: result.user,
      token: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    },
  });
});

export const login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const input = req.body;

  const result = await authService.login(input);

  res.json({
    success: true,
    data: {
      user: result.user,
      token: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    },
  });
});

export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export const me = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }

  const user = await authService.getUserById(req.user.userId);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  res.json({
    success: true,
    data: user,
  });
});

export const refresh = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw ApiError.badRequest('Refresh token is required');
  }

  const tokens = await authService.refreshTokens(refreshToken);

  res.json({
    success: true,
    data: tokens,
  });
});
