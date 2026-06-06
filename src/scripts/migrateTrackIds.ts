import { connectDatabase } from '../config/database.js';
import { DEFAULT_HACKATHON_TRACK_ID } from '../config/tracks.js';
import { Submission, Team } from '../models/index.js';

const LEGACY_TRACK_IDS = ['ai-career-agent', 'recruiter-bridge', 'open-build'];

/**
 * One-time migration after expanding from 3 → 5 tracks.
 * - Clears legacy team.track so captains re-pick in the sprint portal.
 * - Rewrites legacy submission.track to the default new track ID (drafts only).
 *
 * Run: npm run migrate-track-ids
 */
async function main() {
  await connectDatabase();

  const teams = await Team.find({ track: { $in: LEGACY_TRACK_IDS } }).select('_id title track');
  for (const team of teams) {
    await Team.findByIdAndUpdate(team._id, { $unset: { track: 1 } });
    console.log(`Cleared legacy track "${team.track}" on team: ${team.title}`);
  }

  const submissionResult = await Submission.updateMany(
    { track: { $in: LEGACY_TRACK_IDS }, status: 'draft' },
    { $set: { track: DEFAULT_HACKATHON_TRACK_ID } }
  );

  const lockedSubmissions = await Submission.countDocuments({
    track: { $in: LEGACY_TRACK_IDS },
    status: { $ne: 'draft' },
  });

  if (lockedSubmissions > 0) {
    console.warn(
      `${lockedSubmissions} non-draft submission(s) still use legacy track IDs — review manually.`
    );
  }

  console.log(
    `Migration complete. Teams cleared: ${teams.length}. Draft submissions updated: ${submissionResult.modifiedCount}.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
