import { HackathonUser, IHackathonUser } from '../models/HackathonUser.js';
import { HackathonConfig } from '../models/HackathonConfig.js';
import { SocialProof } from '../models/SocialProof.js';
import { getEnv } from '../config/env.js';
import { sendClaimPointsEmail } from './zeptomailService.js';

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function isHackathonReminderWindowOpen(): Promise<boolean> {
  const config = await HackathonConfig.findOne({ isActive: true });
  if (!config) return false;
  return config.endDate.getTime() > Date.now();
}

async function teamHasVerifiedSocialProof(teamId: string): Promise<boolean> {
  return Boolean(await SocialProof.exists({ team: teamId, status: 'verified' }));
}

async function teamsWithVerifiedProofs(): Promise<Set<string>> {
  const teamIds = await SocialProof.distinct('team', { status: 'verified' });
  return new Set(teamIds.map(String));
}

async function recordSuccessfulSend(user: IHackathonUser): Promise<void> {
  user.lastClaimPointsReminderSentAt = new Date();
  user.claimPointsReminderCount = (user.claimPointsReminderCount ?? 0) + 1;
  await user.save();
}

export async function sendClaimPointsEmailIfEligible(
  userOrId: IHackathonUser | string
): Promise<boolean> {
  const user =
    typeof userOrId === 'string' ? await HackathonUser.findById(userOrId) : userOrId;
  if (!user) return false;

  if (user.accountStatus !== 'active') return false;
  if (!user.team) return false;
  if (await teamHasVerifiedSocialProof(user.team.toString())) return false;

  try {
    await sendClaimPointsEmail(user);
    await recordSuccessfulSend(user);
    return true;
  } catch (err) {
    console.error('[claim-points] Immediate send failed', {
      userId: user._id.toString(),
      err,
    });
    return false;
  }
}

export interface ClaimPointsReminderJobResult {
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function runClaimPointsReminderJob(): Promise<ClaimPointsReminderJobResult> {
  const env = getEnv();

  if (env.CLAIM_POINTS_REMINDER_CRON_ENABLED === false) {
    console.info('[claim-points] Job disabled (CLAIM_POINTS_REMINDER_CRON_ENABLED=false)');
    return { eligible: 0, sent: 0, failed: 0, skipped: 0 };
  }

  if (!(await isHackathonReminderWindowOpen())) {
    console.info('[claim-points] Hackathon inactive or ended — skipping');
    return { eligible: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const resendCutoff = hoursAgo(env.CLAIM_POINTS_REMINDER_MIN_HOURS_BETWEEN_SENDS);
  const verifiedTeams = await teamsWithVerifiedProofs();

  const candidates = await HackathonUser.find({
    accountStatus: 'active',
    team: { $exists: true, $ne: null },
    $or: [
      { lastClaimPointsReminderSentAt: { $exists: false } },
      { lastClaimPointsReminderSentAt: null },
      { lastClaimPointsReminderSentAt: { $lte: resendCutoff } },
    ],
  });

  const eligibleUsers = candidates.filter((u) => !verifiedTeams.has(u.team!.toString()));

  let sent = 0;
  let failed = 0;

  for (const user of eligibleUsers) {
    try {
      await sendClaimPointsEmail(user);
      await recordSuccessfulSend(user);
      sent++;
    } catch {
      failed++;
    }
  }

  const result: ClaimPointsReminderJobResult = {
    eligible: eligibleUsers.length,
    sent,
    failed,
    skipped: candidates.length - eligibleUsers.length,
  };

  console.info('[claim-points] Job complete', result);
  return result;
}
