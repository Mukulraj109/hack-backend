import { connectDatabase } from '../config/database.js';
import { runClaimPointsReminderJob } from '../services/claimPointsReminderService.js';

async function main() {
  await connectDatabase();
  const result = await runClaimPointsReminderJob();
  console.log('[claim-points-reminders]', result);
  process.exit(0);
}

main().catch((err) => {
  console.error('[claim-points-reminders] Failed', err);
  process.exit(1);
});
