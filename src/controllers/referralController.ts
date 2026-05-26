import { Response } from 'express';
import { Referral, HackathonUser } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
export const getReferrals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const referrals = await Referral.find({ referrer: req.user.userId }).populate(
    'referee',
    'firstName lastName email'
  );

  res.json({
    success: true,
    data: referrals,
  });
});

export const getReferralStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const user = await HackathonUser.findById(req.user.userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const referrals = await Referral.find({ referrer: req.user.userId });

  const totalInvited = referrals.length;
  const registeredCount = referrals.filter((r) => r.status === 'registered').length;
  const verifiedCount = referrals.filter((r) => r.pointsAwarded).length;
  const pointsEarned = verifiedCount * 15;
  const potentialPoints = totalInvited * 15;

  res.json({
    success: true,
    data: {
      referralCode: user.referralCode,
      inviteUrl: `firststephack.com/join?ref=${user.referralCode}`,
      totalInvited: totalInvited,
      registeredCount,
      verifiedCount,
      pointsEarned,
      potentialPoints,
    },
  });
});

export const getInviteUrl = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const user = await HackathonUser.findById(req.user.userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  res.json({
    success: true,
    data: {
      referralCode: user.referralCode,
      inviteUrl: `firststephack.com/join?ref=${user.referralCode}`,
    },
  });
});

export const trackReferral = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;

  const referrer = await HackathonUser.findOne({ referralCode: code.toUpperCase() });
  if (!referrer) {
    throw ApiError.notFound('Invalid referral code');
  }

  const existingReferral = await Referral.findOne({
    referralCode: code.toUpperCase(),
    refereeEmail: req.body.email,
  });

  if (!existingReferral) {
    await Referral.create({
      referrer: referrer._id,
      referralCode: code.toUpperCase(),
      refereeEmail: req.body.email,
      status: 'pending',
    });
  }

  res.json({
    success: true,
    message: 'Referral tracked',
  });
});
