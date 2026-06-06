import { HackathonUser } from '../models/HackathonUser.js';
import { Team } from '../models/Team.js';
import { getEnv } from '../config/env.js';
import {
  buildScoreUpdateMergeInfo,
  sendScoreUpdateEmail,
} from './zeptomailService.js';

function resolveDashboardUrl(): string {
  const env = getEnv();
  const configured = env.HACKATHON_DASHBOARD_URL?.trim();
  if (configured) return configured;

  const firstOrigin = env.CORS_ORIGIN.split(',')[0]?.trim() || 'http://localhost:5173';
  return `${firstOrigin.replace(/\/$/, '')}/sprint`;
}

async function sendScoreIncreaseToUser(
  userId: string,
  previousScore: number,
  newScore: number,
  reason: string
): Promise<void> {
  const pointsGained = newScore - previousScore;
  if (pointsGained <= 0) return;

  const user = await HackathonUser.findById(userId);
  if (!user || user.accountStatus !== 'active') return;

  const mergeInfo = buildScoreUpdateMergeInfo(user, {
    previousScore,
    newScore,
    pointsGained,
    reason,
    dashboardUrl: resolveDashboardUrl(),
  });

  await sendScoreUpdateEmail(user, mergeInfo);
}

export async function notifyTeamScoreIncrease(
  teamId: string,
  previousScore: number,
  newScore: number,
  reason: string
): Promise<void> {
  if (newScore <= previousScore) return;

  const team = await Team.findById(teamId).select('members');
  if (!team) return;

  for (const memberId of team.members) {
    try {
      await sendScoreIncreaseToUser(memberId.toString(), previousScore, newScore, reason);
    } catch (err) {
      console.error('[score-update] Team member email failed', {
        teamId,
        memberId: memberId.toString(),
        err,
      });
    }
  }
}

export async function notifyUserScoreIncrease(
  userId: string,
  previousScore: number,
  newScore: number,
  reason: string
): Promise<void> {
  try {
    await sendScoreIncreaseToUser(userId, previousScore, newScore, reason);
  } catch (err) {
    console.error('[score-update] User email failed', { userId, err });
  }
}

export function socialProofVerifyReason(platform: string): string {
  if (platform === 'linkedin') return 'LinkedIn share verified';
  if (platform === 'instagram') return 'Instagram share verified';
  return 'Social share verified';
}
