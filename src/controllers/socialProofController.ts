import { NextFunction, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SocialProof, Team, ITeam } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { getStorageBucket, isFirebaseEnabled } from '../config/firebase.js';
import {
  SOCIAL_PLATFORM_POINTS,
  syncTeamPoints,
} from '../services/pointsService.js';
import { HackathonConfig } from '../models/HackathonConfig.js';

const SCREENSHOT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SCREENSHOT_MAX_SIZE = 5 * 1024 * 1024;

const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SCREENSHOT_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (SCREENSHOT_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid image type. Only JPG, PNG, and WEBP are allowed.'));
  },
});

export const uploadScreenshotMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  screenshotUpload.single('screenshot')(req as never, res as never, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(ApiError.badRequest('Screenshot is too large. Max allowed size is 5MB.'));
      return;
    }

    if (err instanceof Error && err.message.includes('Invalid image type')) {
      next(ApiError.badRequest(err.message));
      return;
    }

    next(err as Error);
  });
};

export const verifyProofSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  pointsEarned: z.number().optional(),
});

async function assertTeamMember(teamId: string, userId: string): Promise<ITeam> {
  const team = await Team.findById(teamId);
  if (!team) {
    throw ApiError.notFound('Team not found');
  }

  const memberIds = team.members.map((m) => m.toString());
  if (!memberIds.includes(userId)) {
    throw ApiError.forbidden('You must be a member of this team');
  }

  return team;
}

async function uploadScreenshotToFirebase(
  teamId: string,
  platform: string,
  file: Express.Multer.File
): Promise<string> {
  if (!isFirebaseEnabled()) {
    throw new ApiError(
      503,
      'Screenshot uploads are temporarily unavailable. Storage is not configured.'
    );
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const safeExt = ext && ext.length <= 6 ? ext : '.jpg';
  const fileName = `${Date.now()}_${uuidv4()}${safeExt}`;
  const bucket = getStorageBucket();
  const storagePath = `social-proof/${teamId}/${platform}/${fileName}`;
  const storageFile = bucket.file(storagePath);

  await storageFile.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    resumable: false,
  });

  await storageFile.makePublic();
  return typeof storageFile.publicUrl === 'function'
    ? storageFile.publicUrl()
    : `https://storage.googleapis.com/${bucket.name}/${storageFile.name}`;
}

export const getTeamSocialProofs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.hackathonUser;
  if (!user) {
    throw ApiError.unauthorized();
  }

  const { teamId } = req.params;
  await assertTeamMember(teamId, user._id.toString());

  const proofs = await SocialProof.find({ team: teamId })
    .populate('submittedBy', 'firstName lastName email')
    .sort({ platform: 1 });

  res.json({
    success: true,
    data: proofs,
  });
});

export const submitTeamSocialProof = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.hackathonUser;
  if (!user) {
    throw ApiError.unauthorized();
  }

  const { teamId } = req.params;
  await assertTeamMember(teamId, user._id.toString());

  const platform = req.body.platform as string;
  if (platform !== 'instagram' && platform !== 'linkedin') {
    throw ApiError.badRequest('Platform must be instagram or linkedin');
  }

  const postUrl = typeof req.body.postUrl === 'string' ? req.body.postUrl.trim() : '';
  if (!postUrl) {
    throw ApiError.badRequest('Post URL is required');
  }

  try {
    new URL(postUrl);
  } catch {
    throw ApiError.badRequest('Invalid post URL');
  }

  if (!req.file) {
    throw ApiError.badRequest('No image uploaded. Use form field name `screenshot`.');
  }

  const templateId =
    typeof req.body.templateId === 'string' ? req.body.templateId.trim() : undefined;

  const config = await HackathonConfig.findOne({ isActive: true });
  const hashtag = config?.socialHashtag ?? '#ShipIn100Hrs';

  const screenshotUrl = await uploadScreenshotToFirebase(teamId, platform, req.file);

  const existing = await SocialProof.findOne({ team: teamId, platform });

  if (existing?.status === 'verified') {
    throw ApiError.conflict('This platform is already verified for your team');
  }

  let proof;

  if (!existing) {
    proof = await SocialProof.create({
      team: teamId,
      submittedBy: user._id,
      platform,
      postUrl,
      screenshotUrl,
      templateId,
      hashtag,
      status: 'pending',
    });
  } else if (existing.status === 'pending' || existing.status === 'rejected') {
    existing.postUrl = postUrl;
    existing.screenshotUrl = screenshotUrl;
    existing.submittedBy = user._id;
    existing.templateId = templateId;
    existing.hashtag = hashtag;
    existing.status = 'pending';
    existing.verifiedAt = undefined;
    existing.verifiedBy = undefined;
    existing.pointsEarned = SOCIAL_PLATFORM_POINTS;
    await existing.save();
    proof = existing;
  } else {
    throw ApiError.conflict('Cannot update proof in current status');
  }

  const populated = await SocialProof.findById(proof._id).populate(
    'submittedBy',
    'firstName lastName email'
  );

  res.status(existing ? 200 : 201).json({
    success: true,
    data: populated,
    message: 'Social proof submitted for review',
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
    .populate('team', 'title inviteCode')
    .populate('submittedBy', 'firstName lastName email')
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
    proof.pointsEarned = pointsEarned ?? SOCIAL_PLATFORM_POINTS;
  } else if (status === 'rejected') {
    proof.verifiedAt = undefined;
  }

  await proof.save();

  await syncTeamPoints(proof.team.toString());

  res.json({
    success: true,
    data: proof,
    message: `Social proof ${status}`,
  });
});
