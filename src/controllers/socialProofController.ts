import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { SocialProof, HackathonUser } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import * as pointsService from '../services/pointsService.js';

export const submitProofSchema = z.object({
  platform: z.enum(['instagram', 'linkedin', 'twitter']),
  postUrl: z.string().url('Invalid URL'),
  screenshotUrl: z.string().url().optional(),
  hashtag: z.string().optional(),
});

export const verifyProofSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  pointsEarned: z.number().optional(),
});

export const submitProof = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const existing = await SocialProof.findOne({
    user: req.user.userId,
    platform: req.body.platform,
  });

  if (existing) {
    throw ApiError.conflict('You have already submitted proof for this platform');
  }

  const proof = await SocialProof.create({
    ...req.body,
    user: req.user.userId,
  });

  res.status(201).json({
    success: true,
    data: proof,
    message: 'Social proof submitted for verification',
  });
});

export const getProofs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const proofs = await SocialProof.find({ user: req.user.userId });

  res.json({
    success: true,
    data: proofs,
  });
});

export const getAllProofs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { status } = req.query;
  const filter: Record<string, string> = {};

  if (status) filter.status = status as string;

  const proofs = await SocialProof.find(filter)
    .populate('user', 'firstName lastName email')
    .populate('verifiedBy', 'name email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: proofs,
  });
});

export const verifyProof = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { id } = req.params;
  const { status, pointsEarned } = req.body;

  const proof = await SocialProof.findById(id);
  if (!proof) {
    throw ApiError.notFound('Social proof not found');
  }

  proof.status = status;
  proof.verifiedBy = new mongoose.Types.ObjectId(req.user.userId);

  if (status === 'verified') {
    proof.verifiedAt = new Date();
    proof.pointsEarned = pointsEarned || proof.pointsEarned;
  }

  await proof.save();

  if (status === 'verified') {
    const userPoints = await pointsService.calculateUserPoints(proof.user.toString());
    await HackathonUser.findByIdAndUpdate(proof.user, { totalPoints: userPoints });
  }

  res.json({
    success: true,
    data: proof,
    message: `Social proof ${status}`,
  });
});
