import { Response } from 'express';
import { z } from 'zod';
import { HackathonUser, Submission, Team } from '../models/index.js';
import { ISubmission } from '../models/Submission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { assertSubmissionAccess } from '../utils/submissionAccess.js';

const optionalUrl = z.union([z.string().url(), z.literal('')]).optional();

export const createSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  deckUrl: optionalUrl,
  technicalRoadblock: z.string().optional(),
  sponsorApis: z.string().optional(),
  supplementaryZipConfirmed: z.boolean().optional(),
  track: z.string().min(1, 'Track is required'),
});

export const updateSubmissionSchema = createSubmissionSchema.partial();

function normalizeOptionalUrls(body: Record<string, unknown>): void {
  for (const key of ['repoUrl', 'demoUrl', 'deckUrl'] as const) {
    if (body[key] === '') {
      body[key] = undefined;
    }
  }
}

async function validateFinalizeRequirements(userId: string, submission: ISubmission): Promise<void> {
  const user = await HackathonUser.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const missing: string[] = [];

  if (!user.linkedinUrl) missing.push('LinkedIn profile URL');
  if (!user.resumeUrl) missing.push('Resume');
  if (!user.hiringStatus) missing.push('Hiring status');
  if (!user.availabilityTimeline) missing.push('Availability timeline');

  if (!submission.repoUrl) missing.push('GitHub repository URL');
  if (!submission.demoUrl) missing.push('Demo video link');
  if (!submission.description || submission.description.trim().length < 50) {
    missing.push('Solution one-pager (at least 50 characters)');
  }
  if (!submission.technicalRoadblock?.trim()) {
    missing.push('Technical roadblock answer');
  }
  if (!submission.sponsorApis?.trim()) missing.push('Sponsor APIs answer');
  if (!submission.supplementaryZipConfirmed) {
    missing.push('Confirmation that your ZIP was emailed to the hackathon inbox');
  }
  if (!submission.track) missing.push('Track');

  if (missing.length > 0) {
    throw ApiError.badRequest(`Complete required fields before locking in: ${missing.join(', ')}`);
  }
}

export const createSubmission = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  normalizeOptionalUrls(req.body);
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

  normalizeOptionalUrls(req.body);
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

  await validateFinalizeRequirements(req.user.userId, submission);

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
  if (!req.user) throw ApiError.unauthorized();

  const { id } = req.params;
  const submission = await Submission.findById(id).populate('team', 'title track members');

  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  await assertSubmissionAccess(req.user.userId, submission);

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
