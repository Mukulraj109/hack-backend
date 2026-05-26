import { Team } from '../models/Team.js';

const PREFIX = 'FST_100_';

export async function generateTeamInviteCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 50) {
    const suffix = String(Math.floor(100 + Math.random() * 900));
    const code = `${PREFIX}${suffix}`.toUpperCase();
    const exists = await Team.findOne({ inviteCode: code });
    if (!exists) {
      return code;
    }
    attempts += 1;
  }
  const fallback = `${PREFIX}${Date.now().toString().slice(-3)}`;
  return fallback;
}
