import { connectDatabase } from '../config/database.js';
import { runTeamReminderJob } from '../services/teamReminderService.js';

async function main() {
  await connectDatabase();
  const result = await runTeamReminderJob();
  console.log('[team-reminders]', result);
  process.exit(0);
}

main().catch((err) => {
  console.error('[team-reminders] Failed', err);
  process.exit(1);
});
