import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { toSessionUser } from '../services/hackathonUserService.js';
import { getUserTeam } from '../services/teamService.js';
import { formatTeamMembers } from '../utils/teamMembers.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../utils/ApiError.js';
import { getStorageBucket, isFirebaseEnabled } from '../config/firebase.js';
import { getPointsBreakdown } from '../services/pointsBreakdownService.js';

export const careerProfileSchema = z.object({
  linkedinUrl: z.string().url('Valid LinkedIn URL is required'),
  hiringStatus: z.enum(['actively_looking', 'open_to_offers', 'not_looking']),
  availabilityTimeline: z.enum(['immediate', 'one_to_three_months', 'three_plus_months']),
});

const HEADSHOT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const HEADSHOT_MAX_SIZE = 5 * 1024 * 1024;

const headshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HEADSHOT_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (HEADSHOT_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid image type. Only JPG, PNG, and WEBP are allowed.'));
  },
});

const RESUME_ALLOWED_TYPES = ['application/pdf'];
const RESUME_MAX_SIZE = 5 * 1024 * 1024;

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: RESUME_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (
      RESUME_ALLOWED_TYPES.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid file type. Only PDF resumes are allowed.'));
  },
});

export const uploadResumeMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  resumeUpload.single('resume')(req as never, res as never, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(ApiError.badRequest('Resume is too large. Max allowed size is 5MB.'));
      return;
    }

    if (err instanceof Error && err.message.includes('Invalid file type')) {
      next(ApiError.badRequest(err.message));
      return;
    }

    next(err as Error);
  });
};

export const uploadHeadshotMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  headshotUpload.single('headshot')(req as never, res as never, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(ApiError.badRequest('Image is too large. Max allowed size is 5MB.'));
      return;
    }

    if (err instanceof Error && err.message.includes('Invalid image type')) {
      next(ApiError.badRequest(err.message));
      return;
    }

    next(err as Error);
  });
};

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.hackathonUser!;
  const session = toSessionUser(user);
  const userId = user._id.toString();

  const team = await getUserTeam(userId);

  res.json({
    success: true,
    data: {
      user: session,
      team: team
        ? {
            id: team._id,
            title: team.title,
            inviteCode: team.inviteCode,
            track: team.track,
            totalPoints: team.totalPoints ?? 0,
            memberCount: team.members.length,
            members: formatTeamMembers(team, userId),
          }
        : null,
    },
  });
});

export const getPointsBreakdownHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.hackathonUser!;
    const userId = user._id.toString();

    const breakdown = await getPointsBreakdown(userId);

    res.json({
      success: true,
      data: breakdown,
    });
  }
);

export const updateCareerProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.hackathonUser;
  if (!user) {
    throw ApiError.unauthorized();
  }

  const { linkedinUrl, hiringStatus, availabilityTimeline } = req.body as z.infer<
    typeof careerProfileSchema
  >;

  user.linkedinUrl = linkedinUrl;
  user.hiringStatus = hiringStatus;
  user.availabilityTimeline = availabilityTimeline;
  await user.save();

  res.json({
    success: true,
    data: toSessionUser(user),
    message: 'Career profile updated.',
  });
});

export const uploadMyResume = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.hackathonUser;
  if (!user) {
    throw ApiError.unauthorized();
  }
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded. Use form field name `resume`.');
  }
  if (!isFirebaseEnabled()) {
    throw new ApiError(503, 'Resume uploads are temporarily unavailable. Storage is not configured.');
  }

  const fileName = `${Date.now()}_${uuidv4()}.pdf`;
  const bucket = getStorageBucket();
  const file = bucket.file(`resumes/${user._id.toString()}/${fileName}`);

  await file.save(req.file.buffer, {
    metadata: {
      contentType: 'application/pdf',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    resumable: false,
  });

  await file.makePublic();
  const publicUrl =
    typeof file.publicUrl === 'function'
      ? file.publicUrl()
      : `https://storage.googleapis.com/${bucket.name}/${file.name}`;

  user.resumeUrl = publicUrl;
  user.resumeFileName = req.file.originalname;
  user.resumeUpdatedAt = new Date();
  await user.save();

  res.json({
    success: true,
    data: {
      resumeUrl: user.resumeUrl,
      resumeFileName: user.resumeFileName,
      resumeUpdatedAt: user.resumeUpdatedAt,
    },
    message: 'Resume uploaded successfully.',
  });
});

export const uploadMyHeadshot = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.hackathonUser;
  if (!user) {
    throw ApiError.unauthorized();
  }
  if (!req.file) {
    throw ApiError.badRequest('No image uploaded. Use form field name `headshot`.');
  }
  if (!isFirebaseEnabled()) {
    throw new ApiError(503, 'Image uploads are temporarily unavailable. Storage is not configured.');
  }

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const safeExt = ext && ext.length <= 6 ? ext : '.jpg';
  const fileName = `${Date.now()}_${uuidv4()}${safeExt}`;
  const bucket = getStorageBucket();
  const file = bucket.file(`headshots/${user._id.toString()}/${fileName}`);

  await file.save(req.file.buffer, {
    metadata: {
      contentType: req.file.mimetype,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    resumable: false,
  });

  await file.makePublic();
  const publicUrl =
    typeof file.publicUrl === 'function'
      ? file.publicUrl()
      : `https://storage.googleapis.com/${bucket.name}/${file.name}`;

  user.headshotUrl = publicUrl;
  user.headshotUpdatedAt = new Date();
  await user.save();

  res.json({
    success: true,
    data: {
      headshotUrl: user.headshotUrl,
      headshotUpdatedAt: user.headshotUpdatedAt,
    },
    message: 'Headshot uploaded successfully.',
  });
});
