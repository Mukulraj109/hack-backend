import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { initializeFirebase } from './config/firebase.js';
import { getEnv } from './config/env.js';
import { scheduleTeamReminderCron } from './jobs/teamReminderCron.js';
import { scheduleClaimPointsReminderCron } from './jobs/claimPointsReminderCron.js';

async function main() {
  try {
    const env = getEnv();

    await connectDatabase();

    if (env.TEAM_REMINDER_CRON_ENABLED) {
      scheduleTeamReminderCron(env.TEAM_REMINDER_CRON_SCHEDULE);
    }

    if (env.CLAIM_POINTS_REMINDER_CRON_ENABLED) {
      scheduleClaimPointsReminderCron(env.CLAIM_POINTS_REMINDER_CRON_SCHEDULE);
    }

    initializeFirebase();

    const app = createApp();

    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
      console.log(`📚 API: http://localhost:${env.PORT}/api`);
      console.log(`🏥 Health: http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
