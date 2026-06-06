import { HackathonUser, IHackathonUser } from '../models/HackathonUser.js';
import { HackathonConfig } from '../models/HackathonConfig.js';
import { Team } from '../models/Team.js';
import { getEnv } from '../config/env.js';
import { sendTeamReminderEmail } from './zeptomailService.js';

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function isHackathonReminderWindowOpen(): Promise<boolean> {
  const config = await HackathonConfig.findOne({ isActive: true });
  if (!config) return false;
  return config.endDate.getTime() > Date.now();
}

async function memberUserIdSet(): Promise<Set<string>> {
  const memberIds = await Team.distinct('members');
  return new Set(memberIds.map(String));
}

export interface TeamReminderJobResult {
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function runTeamReminderJob(): Promise<TeamReminderJobResult> {
  const env = getEnv();

  if (env.TEAM_REMINDER_CRON_ENABLED === false) {
    console.info('[team-reminder] Job disabled (TEAM_REMINDER_CRON_ENABLED=false)');
    return { eligible: 0, sent: 0, failed: 0, skipped: 0 };
  }

  if (!(await isHackathonReminderWindowOpen())) {
    console.info('[team-reminder] Hackathon inactive or ended — skipping');
    return { eligible: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const minHoursAfterActive = env.TEAM_REMINDER_MIN_HOURS_AFTER_ACTIVE;
  const minHoursBetweenSends = env.TEAM_REMINDER_MIN_HOURS_BETWEEN_SENDS;
  const activatedCutoff = hoursAgo(minHoursAfterActive);
  const resendCutoff = hoursAgo(minHoursBetweenSends);

  const candidates = await HackathonUser.find({
    accountStatus: 'active',
    $and: [
      {
        $or: [
          { registrationCompletedAt: { $exists: true, $ne: null } },
          { zohoSubmissionId: { $exists: true, $ne: null } },
        ],
      },
      {
        $or: [{ team: null }, { team: { $exists: false } }],
      },
      {
        activatedAt: { $exists: true, $ne: null, $lte: activatedCutoff },
      },
      {
        $or: [
          { lastTeamReminderSentAt: { $exists: false } },
          { lastTeamReminderSentAt: null },
          { lastTeamReminderSentAt: { $lte: resendCutoff } },
        ],
      },
    ],
  });

  const members = await memberUserIdSet();
  const eligibleUsers = candidates.filter((u) => !members.has(u._id.toString()));

  let sent = 0;
  let failed = 0;

  for (const user of eligibleUsers) {
    try {
      await sendTeamReminderEmail(user);
      user.lastTeamReminderSentAt = new Date();
      user.teamReminderCount = (user.teamReminderCount ?? 0) + 1;
      await user.save();
      sent++;
    } catch {
      failed++;
    }
  }

  const result: TeamReminderJobResult = {
    eligible: eligibleUsers.length,
    sent,
    failed,
    skipped: candidates.length - eligibleUsers.length,
  };

  console.info('[team-reminder] Job complete', result);
  return result;
}
