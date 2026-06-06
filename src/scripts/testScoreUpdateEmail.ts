import mongoose from 'mongoose';
import { IHackathonUser } from '../models/HackathonUser.js';
import { getEnv } from '../config/env.js';
import { buildScoreUpdateMergeInfo, sendScoreUpdateEmail } from '../services/zeptomailService.js';

function resolveDashboardUrl(): string {
  const env = getEnv();
  const configured = env.HACKATHON_DASHBOARD_URL?.trim();
  if (configured) return configured;

  const firstOrigin = env.CORS_ORIGIN.split(',')[0]?.trim() || 'http://localhost:5173';
  return `${firstOrigin.replace(/\/$/, '')}/sprint`;
}

async function main() {
  const email = process.argv[2] ?? 'mukulraj756@gmail.com';
  const firstName = process.argv[3] ?? 'Mukul';

  const user = {
    _id: new mongoose.Types.ObjectId(),
    email,
    firstName,
    lastName: '',
  } as IHackathonUser;

  const mergeInfo = buildScoreUpdateMergeInfo(user, {
    previousScore: 50,
    newScore: 75,
    pointsGained: 25,
    reason: 'Test score update',
    dashboardUrl: resolveDashboardUrl(),
  });

  console.info('[test-score-update] Sending to', email, 'as', firstName);
  await sendScoreUpdateEmail(user, mergeInfo);
  console.info('[test-score-update] Done');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-score-update] Failed', err);
  process.exit(1);
});
