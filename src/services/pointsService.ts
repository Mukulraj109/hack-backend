import {
  HackathonUser,
  SocialProof,
  JudgeScore,
  Submission,
  Team,
  HackathonConfig,
} from '../models/index.js';

export const REGISTRATION_POINTS = 25;
export const SOCIAL_PLATFORM_POINTS = 25;

export interface PointsCaps {
  maxPoints: number;
  maxJudgePoints: number;
  maxSprintPoints: number;
}

export async function getPointsCaps(): Promise<PointsCaps> {
  const config = await HackathonConfig.findOne({ isActive: true });
  return {
    maxPoints: config?.maxPoints ?? 250,
    maxJudgePoints: config?.maxJudgePoints ?? 175,
    maxSprintPoints: config?.maxSprintPoints ?? 75,
  };
}

/** Verified team social proofs (max 50 for IG + LI). */
export async function getTeamSocialPoints(teamId: string): Promise<number> {
  const verifiedProofs = await SocialProof.find({
    team: teamId,
    platform: { $in: ['instagram', 'linkedin'] },
    status: 'verified',
  });

  let total = 0;
  for (const proof of verifiedProofs) {
    total += proof.pointsEarned || SOCIAL_PLATFORM_POINTS;
  }
  return total;
}

/** Sum of judge scores for team submissions, capped at maxJudgePoints. */
export async function getJudgePointsForTeam(
  teamId: string,
  maxJudgePoints?: number
): Promise<number> {
  const caps = maxJudgePoints ?? (await getPointsCaps()).maxJudgePoints;

  const submissions = await Submission.find({
    team: teamId,
    status: 'judged',
  });

  if (submissions.length === 0) return 0;

  const scoredSubmission = submissions.find((s) => s.judgePoints != null);
  if (scoredSubmission) {
    return Math.min(scoredSubmission.judgePoints ?? 0, caps);
  }

  const judgeResult = await JudgeScore.aggregate([
    { $match: { submission: { $in: submissions.map((s) => s._id) } } },
    { $group: { _id: null, total: { $sum: '$totalScore' } } },
  ]);

  const raw = judgeResult.length > 0 ? judgeResult[0].total : 0;
  return Math.min(raw, caps);
}

/** Team total: registration (once) + social + judge (capped). */
export async function calculateTeamPoints(teamId: string): Promise<number> {
  const team = await Team.findById(teamId);
  if (!team) return 0;

  const caps = await getPointsCaps();
  const registrationPoints = REGISTRATION_POINTS;
  const socialPoints = await getTeamSocialPoints(teamId);
  const judgePoints = await getJudgePointsForTeam(teamId, caps.maxJudgePoints);
  const manualBonus = team.manualPointsBonus ?? 0;

  const totalPoints = Math.min(
    registrationPoints + socialPoints + judgePoints + manualBonus,
    caps.maxPoints
  );
  await Team.findByIdAndUpdate(teamId, { totalPoints });
  return totalPoints;
}

/** Recalculate team score and mirror totalPoints onto all members. */
export async function syncTeamPoints(teamId: string): Promise<number> {
  const total = await calculateTeamPoints(teamId);
  const team = await Team.findById(teamId);
  if (!team) return total;

  for (const memberId of team.members) {
    await HackathonUser.findByIdAndUpdate(memberId, { totalPoints: total });
  }

  return total;
}

/** Clear cached points for a user who left a team. */
export async function clearUserPoints(userId: string): Promise<void> {
  await HackathonUser.findByIdAndUpdate(userId, { totalPoints: 0 });
}

/** User display total: team score if on a team, else solo manual bonus. */
export async function getUserTeamPoints(userId: string): Promise<number> {
  const user = await HackathonUser.findById(userId);
  if (!user) return 0;
  if (!user.team) return user.manualPointsBonus ?? 0;
  return calculateTeamPoints(user.team.toString());
}

export async function awardReferralPoints(referrerId: string): Promise<void> {
  const { Referral } = await import('../models/index.js');
  const referral = await Referral.findOne({
    referrer: referrerId,
    status: 'registered',
    pointsAwarded: false,
  });

  if (!referral) return;

  referral.pointsAwarded = true;
  await referral.save();

  const team = await Team.findOne({ members: referrerId });
  if (team) {
    await syncTeamPoints(team._id.toString());
  }
}
