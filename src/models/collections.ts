/**
 * Hackathon platform collections in `firststep_db`.
 * Separate from FirstStep main app collections (e.g. `users`).
 * MongoDB creates each collection on first insert.
 */
export const HACKATHON_COLLECTIONS = {
  users: 'hackathon_users',
  teams: 'hackathon_teams',
  submissions: 'hackathon_submissions',
  tasks: 'hackathon_tasks',
  taskProgress: 'hackathon_task_progress',
  referrals: 'hackathon_referrals',
  socialProofs: 'hackathon_social_proofs',
  judgeScores: 'hackathon_judge_scores',
  announcements: 'hackathon_announcements',
  config: 'hackathon_config',
} as const;
