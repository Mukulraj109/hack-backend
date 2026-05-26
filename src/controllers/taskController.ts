import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Task, TaskProgress } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import * as pointsService from '../services/pointsService.js';

export const submitTaskSchema = z.object({
  proofUrl: z.string().url('Invalid URL'),
  platform: z.enum(['instagram', 'linkedin', 'twitter']).optional(),
});

export const verifyTaskSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  notes: z.string().optional(),
});

export const getTasks = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const tasks = await Task.find({ isActive: true }).sort({ sortOrder: 1 });

  res.json({
    success: true,
    data: tasks,
  });
});

export const getTaskProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const progress = await TaskProgress.find({ user: req.user.userId }).populate('task');

  res.json({
    success: true,
    data: progress,
  });
});

export const submitTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { id } = req.params;
  const { proofUrl, platform } = req.body;

  const task = await Task.findById(id);
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  let progress = await TaskProgress.findOne({
    user: req.user.userId,
    task: id,
  });

  if (progress) {
    if (progress.status === 'verified') {
      throw ApiError.badRequest('Task already completed');
    }
    progress.proofUrl = proofUrl;
    progress.platform = platform;
    progress.status = 'submitted';
  } else {
    progress = await TaskProgress.create({
      user: req.user.userId,
      task: id,
      proofUrl,
      platform,
      status: 'submitted',
    });
  }

  await progress.save();

  res.json({
    success: true,
    data: progress,
    message: 'Task submitted for verification',
  });
});

export const verifyTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { id } = req.params;
  const { status, notes } = req.body;

  const progress = await TaskProgress.findById(id).populate('user');
  if (!progress) {
    throw ApiError.notFound('Task progress not found');
  }

  progress.status = status;
  progress.verifiedAt = status === 'verified' ? new Date() : undefined;
  progress.verifiedBy = new mongoose.Types.ObjectId(req.user.userId);
  if (notes) progress.notes = notes;

  await progress.save();

  if (status === 'verified') {
    await pointsService.calculateUserPoints((progress.user as any)._id.toString());
  }

  res.json({
    success: true,
    data: progress,
    message: `Task ${status} successfully`,
  });
});

export const getAllTaskProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { status } = req.query;
  const filter: any = {};

  if (status) {
    filter.status = status;
  }

  const progress = await TaskProgress.find(filter)
    .populate('user', 'name email')
    .populate('task')
    .populate('verifiedBy', 'name');

  res.json({
    success: true,
    data: progress,
  });
});
