import { Response } from 'express';
import { z } from 'zod';
import {
  HackathonUser,
  Submission,
  SocialProof,
  Team,
} from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { hasRegistration } from '../services/hackathonUserService.js';
import {
  SOCIAL_PLATFORM_POINTS,
  syncTeamPoints,
  getPointsCaps,
} from '../services/pointsService.js';

const SUBMITTER_FIELDS =
  'firstName lastName email linkedinUrl resumeUrl resumeFileName hiringStatus availabilityTimeline';

export const updateAccountStatusSchema = z.object({
  accountStatus: z.enum(['active', 'rejected', 'suspended', 'pending']),
});

export const updateSubmissionStatusSchema = z.object({
  status: z.enum(['draft', 'submitted', 'under_review', 'judged']),
});

export const scoreSubmissionJudgeSchema = z.object({
  judgePoints: z.number().int().min(0).max(175),
  judgeFeedback: z.string().max(1000).optional(),
});

export const verifySocialProofSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  pointsEarned: z.number().optional(),
});

export const addUserPointsSchema = z.object({
  points: z.number().int().min(1).max(50),
  note: z.string().max(200).optional(),
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUserSearchFilter(query: string): Record<string, unknown> {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const regex = new RegExp(escapeRegex(trimmed), 'i');
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return {
      $or: [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        {
          $and: [
            { firstName: new RegExp(escapeRegex(parts[0]), 'i') },
            { lastName: new RegExp(escapeRegex(parts.slice(1).join(' ')), 'i') },
          ],
        },
      ],
    };
  }

  return {
    $or: [{ email: regex }, { firstName: regex }, { lastName: regex }],
  };
}

export const getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { accountStatus, hasRegistration: hasRegistrationParam, search } = req.query;
  const filter: Record<string, unknown> = {};
  const andConditions: Record<string, unknown>[] = [];

  if (typeof accountStatus === 'string' && accountStatus) {
    filter.accountStatus = accountStatus;
  } else if (typeof search !== 'string' || !search.trim()) {
    filter.accountStatus = 'pending';
  }

  if (hasRegistrationParam === 'true') {
    andConditions.push({
      $or: [
        { registrationCompletedAt: { $exists: true, $ne: null } },
        { zohoSubmissionId: { $exists: true, $ne: null } },
      ],
    });
  }

  if (typeof search === 'string' && search.trim()) {
    andConditions.push(buildUserSearchFilter(search));
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const users = await HackathonUser.find(filter)
    .select(
      'email firstName lastName phone city state universityName graduationMonthYear currentCompanyName eligibility accountStatus registrationCompletedAt zohoSubmissionId activatedAt createdAt totalPoints manualPointsBonus team'
    )
    .populate('team', 'title totalPoints manualPointsBonus')
    .sort({ registrationCompletedAt: -1, createdAt: -1 })
    .limit(typeof search === 'string' && search.trim() ? 50 : 500);

  res.json({
    success: true,
    data: users.map((user) => ({
      ...user.toJSON(),
      hasRegistration: hasRegistration(user),
    })),
  });
});

export const searchUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q || q.length < 2) {
    res.json({ success: true, data: [] });
    return;
  }

  const users = await HackathonUser.find(buildUserSearchFilter(q))
    .select('email firstName lastName totalPoints manualPointsBonus accountStatus team')
    .populate('team', 'title totalPoints manualPointsBonus')
    .sort({ email: 1 })
    .limit(20);

  res.json({
    success: true,
    data: users.map((user) => user.toJSON()),
  });
});

export const addUserPoints = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { points } = req.body;

  const user = await HackathonUser.findById(id).populate('team', 'title manualPointsBonus totalPoints');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const caps = await getPointsCaps();

  if (user.team) {
    const team = await Team.findById(user.team);
    if (!team) {
      throw ApiError.notFound('Team not found');
    }

    const nextBonus = (team.manualPointsBonus ?? 0) + points;
    if (nextBonus > caps.maxSprintPoints) {
      throw ApiError.badRequest(
        `Manual team bonus cannot exceed ${caps.maxSprintPoints} sprint points (current bonus: ${team.manualPointsBonus ?? 0}).`
      );
    }

    team.manualPointsBonus = nextBonus;
    await team.save();
    const totalPoints = await syncTeamPoints(team._id.toString());

    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        team: team.toJSON(),
        totalPoints,
        manualPointsBonus: team.manualPointsBonus,
      },
      message: `Added ${points} points to ${team.title}`,
    });
    return;
  }

  const nextBonus = (user.manualPointsBonus ?? 0) + points;
  if (nextBonus > caps.maxSprintPoints) {
    throw ApiError.badRequest(
      `Manual bonus cannot exceed ${caps.maxSprintPoints} sprint points (current bonus: ${user.manualPointsBonus ?? 0}).`
    );
  }

  user.manualPointsBonus = nextBonus;
  user.totalPoints = nextBonus;
  await user.save();

  res.json({
    success: true,
    data: {
      user: user.toJSON(),
      totalPoints: user.totalPoints,
      manualPointsBonus: user.manualPointsBonus,
    },
    message: `Added ${points} points to ${user.email}`,
  });
});

export const updateAccountStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { accountStatus } = req.body;

  const user = await HackathonUser.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  user.accountStatus = accountStatus;

  if (accountStatus === 'active') {
    user.activatedAt = new Date();
  } else if (accountStatus === 'pending' || accountStatus === 'rejected') {
    user.activatedAt = undefined;
  }

  await user.save();

  res.json({
    success: true,
    data: {
      ...user.toJSON(),
      hasRegistration: hasRegistration(user),
    },
    message: `Account status updated to ${accountStatus}`,
  });
});

export const getSubmissions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, track, search } = req.query;
  const filter: Record<string, string> = {};

  if (typeof status === 'string' && status) {
    filter.status = status;
  } else {
    filter.status = 'submitted';
  }

  if (typeof track === 'string' && track) {
    filter.track = track;
  }

  let submissions = await Submission.find(filter)
    .populate('team', 'title track members inviteCode')
    .populate('submittedBy', SUBMITTER_FIELDS)
    .sort({ submittedAt: -1 });

  if (typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    submissions = submissions.filter((submission) => {
      const submitter = submission.submittedBy as unknown as {
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;
      const team = submission.team as unknown as { title?: string } | null;
      const haystack = [
        submission.title,
        team?.title,
        submitter?.email,
        submitter?.firstName,
        submitter?.lastName,
        [submitter?.firstName, submitter?.lastName].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  res.json({
    success: true,
    data: submissions,
  });
});

export const getSubmissionById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const submission = await Submission.findById(id)
    .populate('team', 'title track members inviteCode')
    .populate('submittedBy', SUBMITTER_FIELDS);

  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  res.json({
    success: true,
    data: submission,
  });
});

export const updateSubmissionStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const submission = await Submission.findById(id);
  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  submission.status = status;
  await submission.save();

  const populated = await Submission.findById(submission._id)
    .populate('team', 'title track members inviteCode')
    .populate('submittedBy', SUBMITTER_FIELDS);

  res.json({
    success: true,
    data: populated,
    message: `Submission status updated to ${status}`,
  });
});

export const scoreSubmissionJudge = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const admin = req.hackathonUser;
  if (!admin) {
    throw ApiError.unauthorized();
  }

  const { id } = req.params;
  const { judgePoints, judgeFeedback } = req.body;

  const submission = await Submission.findById(id);
  if (!submission) {
    throw ApiError.notFound('Submission not found');
  }

  if (submission.status === 'draft') {
    throw ApiError.badRequest('Submission must be finalized before judging');
  }

  submission.judgePoints = judgePoints;
  submission.judgeFeedback = judgeFeedback?.trim() || undefined;
  submission.judgedBy = admin._id;
  submission.judgedAt = new Date();
  submission.status = 'judged';
  await submission.save();

  if (submission.team) {
    await syncTeamPoints(submission.team.toString());
  }

  const populated = await Submission.findById(submission._id)
    .populate('team', 'title track members inviteCode totalPoints')
    .populate('submittedBy', SUBMITTER_FIELDS)
    .populate('judgedBy', 'firstName lastName email');

  res.json({
    success: true,
    data: populated,
    message: `Judge score saved (${judgePoints} pts)`,
  });
});

export const getSocialProofs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, search } = req.query;
  const filter: Record<string, string> = {};

  if (typeof status === 'string' && status) {
    filter.status = status;
  } else {
    filter.status = 'pending';
  }

  let proofs = await SocialProof.find(filter)
    .populate('team', 'title inviteCode')
    .populate('submittedBy', 'firstName lastName email')
    .populate('verifiedBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

  if (typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    proofs = proofs.filter((proof) => {
      const submitter = proof.submittedBy as unknown as {
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;
      const team = proof.team as unknown as { title?: string } | null;
      const haystack = [
        team?.title,
        proof.platform,
        submitter?.email,
        submitter?.firstName,
        submitter?.lastName,
        [submitter?.firstName, submitter?.lastName].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  res.json({
    success: true,
    data: proofs,
  });
});

export const verifySocialProof = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const admin = req.hackathonUser;
  if (!admin) {
    throw ApiError.unauthorized();
  }

  const { id } = req.params;
  const { status, pointsEarned } = req.body;

  const proof = await SocialProof.findById(id);
  if (!proof) {
    throw ApiError.notFound('Social proof not found');
  }

  proof.status = status;
  proof.verifiedBy = admin._id;

  if (status === 'verified') {
    proof.verifiedAt = new Date();
    proof.pointsEarned = pointsEarned ?? SOCIAL_PLATFORM_POINTS;
  } else if (status === 'rejected') {
    proof.verifiedAt = undefined;
  }

  await proof.save();
  await syncTeamPoints(proof.team.toString());

  const populated = await SocialProof.findById(proof._id)
    .populate('team', 'title inviteCode')
    .populate('submittedBy', 'firstName lastName email')
    .populate('verifiedBy', 'firstName lastName email');

  res.json({
    success: true,
    data: populated,
    message: `Social proof ${status}`,
  });
});
