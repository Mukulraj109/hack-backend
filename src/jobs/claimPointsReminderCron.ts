import cron from 'node-cron';
import { runClaimPointsReminderJob } from '../services/claimPointsReminderService.js';

let scheduled = false;

export function scheduleClaimPointsReminderCron(cronExpression: string): void {
  if (scheduled) return;

  if (!cron.validate(cronExpression)) {
    console.error('[claim-points] Invalid cron expression:', cronExpression);
    return;
  }

  cron.schedule(cronExpression, () => {
    void runClaimPointsReminderJob().catch((err) => {
      console.error('[claim-points] Cron run failed', err);
    });
  });

  scheduled = true;
  console.info('[claim-points] Cron scheduled:', cronExpression);
}
