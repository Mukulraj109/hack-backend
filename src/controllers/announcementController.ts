import { Response } from 'express';
import { z } from 'zod';
import { Announcement } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  detail: z.string().min(1, 'Detail is required'),
  icon: z.enum(['timer', 'calendar']).default('timer'),
});

export const getAnnouncements = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const announcements = await Announcement.find({ isActive: true })
    .sort({ publishedAt: -1 });

  res.json({
    success: true,
    data: announcements,
  });
});

export const createAnnouncement = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const announcement = await Announcement.create({
    ...req.body,
    createdBy: req.user.userId,
  });

  res.status(201).json({
    success: true,
    data: announcement,
  });
});

export const updateAnnouncement = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { id } = req.params;
  const announcement = await Announcement.findByIdAndUpdate(
    id,
    req.body,
    { new: true }
  );

  if (!announcement) {
    throw ApiError.notFound('Announcement not found');
  }

  res.json({
    success: true,
    data: announcement,
  });
});

export const deleteAnnouncement = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const { id } = req.params;
  await Announcement.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Announcement deleted',
  });
});
