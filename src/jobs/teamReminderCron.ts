import cron from 'node-cron';
import { runTeamReminderJob } from '../services/teamReminderService.js';

let scheduled = false;

export function scheduleTeamReminderCron(cronExpression: string): void {
  if (scheduled) return;

  if (!cron.validate(cronExpression)) {
    console.error('[team-reminder] Invalid cron expression:', cronExpression);
    return;
  }

  cron.schedule(cronExpression, () => {
    void runTeamReminderJob().catch((err) => {
      console.error('[team-reminder] Cron run failed', err);
    });
  });

  scheduled = true;
  console.info('[team-reminder] Cron scheduled:', cronExpression);
}
