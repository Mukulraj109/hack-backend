import { Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Submission, Team } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { getStorageBucket } from '../config/firebase.js';
import { assertSubmissionAccess, submissionStorageKey } from '../utils/submissionAccess.js';

export const createSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  repoUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  deckUrl: z.string().url().optional(),
  track: z.string().min(1, 'Track is required'),
});

export const updateSubmissionSchema = createSubmissionSchema.partial();

const ALLOWED_TYPES = ['application/pdf', 'application/zip', 'application/x-zip-compressed', 'video/mp4'];
const MAX_SIZE = 250 * 1024 * 1024; // 250MB

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype) || file.originalname.match(/\.(pdf|zip|mp4)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, ZIP, and MP4 are allowed.'));
    }
  },
});

export const uploadMiddleware = upload.single('file');

export const createSubmission = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const userId = req.user.userId;
  const team = await Team.findOne({ members: userId });

  if (team) {
    const existingSubmission = await Submission.findOne({ team: team._id });
    if (existingSubmission) {
      throw ApiError.conflict('You already have a submission for this team');
    }

    const submission = await Submission.create({
      ...req.body,
      team: team._id,
      submittedBy: userId,
    });

    res.status(201).json({ success: true, data: submission });
    return;
  }

  const existingSolo = await Submission.findOne({
    submittedBy: userId,
    $or: [{ team: null }, { team: { $exists: false } }],
  });
  if (existingSolo) {
    throw ApiError.conflict('You already have a submission');
  }

  const submission = await Submission.create({
    ...req.body,
    submittedBy: userId,
  });

  res.status(201).json({
    success: true,
    data: submission,
  });
});

export const updateSubmission = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { id } = req.params;
  const submission = await Submission.findById(id);

  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  await assertSubmissionAccess(req.user.userId, submission);

  if (submission.status !== 'draft') {
    throw ApiError.badRequest('Cannot update submission after finalization');
  }

  Object.assign(submission, req.body);
  await submission.save();

  res.json({
    success: true,
    data: submission,
  });
});

export const uploadFile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded');
  }

  const { id } = req.params;
  const submission = await Submission.findById(id);

  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  await assertSubmissionAccess(req.user.userId, submission);

  const fileName = `${uuidv4()}_${req.file.originalname}`;
  const bucket = getStorageBucket();
  const file = bucket.file(`submissions/${submissionStorageKey(submission)}/${fileName}`);

  await file.save(req.file.buffer, {
    metadata: {
      contentType: req.file.mimetype,
    },
  });

  await file.makePublic();

  const url =
    typeof file.publicUrl === 'function'
      ? file.publicUrl()
      : `https://storage.googleapis.com/${bucket.name}/${file.name}`;

  submission.fileUrl = url;
  submission.fileName = req.file.originalname;
  submission.fileSize = req.file.size;
  await submission.save();

  res.json({
    success: true,
    data: {
      fileUrl: url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    },
  });
});

export const finalizeSubmission = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { id } = req.params;
  const submission = await Submission.findById(id);

  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  await assertSubmissionAccess(req.user.userId, submission);

  if (submission.status !== 'draft') {
    throw ApiError.badRequest('Submission already finalized');
  }

  if (!submission.fileUrl) {
    throw ApiError.badRequest('Please upload a file before finalizing');
  }

  submission.status = 'submitted';
  submission.submittedAt = new Date();
  await submission.save();

  res.json({
    success: true,
    data: submission,
    message: 'Submission finalized and sent for judging',
  });
});

export const getSubmission = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const submission = await Submission.findById(id)
    .populate('team', 'title track members');

  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  res.json({
    success: true,
    data: submission,
  });
});

export const getMySubmission = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const userId = req.user.userId;
  const team = await Team.findOne({ members: userId });

  let submission = null;
  if (team) {
    submission = await Submission.findOne({ team: team._id });
  } else {
    submission = await Submission.findOne({
      submittedBy: userId,
      $or: [{ team: null }, { team: { $exists: false } }],
    });
  }

  res.json({
    success: true,
    data: submission,
  });
});

export const getAllSubmissions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, track } = req.query;
  const filter: any = {};

  if (status) filter.status = status;
  if (track) filter.track = track;

  const submissions = await Submission.find(filter)
    .populate('team', 'title track members')
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

  const submission = await Submission.findById(id);
  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  submission.status = status;
  await submission.save();

  res.json({
    success: true,
    data: submission,
    message: `Submission status updated to ${status}`,
  });
});
