import { connectDatabase } from '../config/database.js';
import { HackathonUser, Team } from '../models/index.js';
import { syncTeamPoints, clearUserPoints } from '../services/pointsService.js';

async function main() {
  await connectDatabase();

  const teams = await Team.find({}).select('_id title');
  let teamCount = 0;

  for (const team of teams) {
    const total = await syncTeamPoints(team._id.toString());
    teamCount += 1;
    console.log(`Team ${team.title}: ${total} pts`);
  }

  const cleared = await HackathonUser.updateMany(
    { $or: [{ team: null }, { team: { $exists: false } }] },
    { $set: { totalPoints: 0 } }
  );

  const orphanUsers = await HackathonUser.find({
    team: { $exists: true, $ne: null },
  }).select('_id team');

  for (const user of orphanUsers) {
    const stillMember = await Team.exists({
      _id: user.team,
      members: user._id,
    });
    if (!stillMember) {
      await clearUserPoints(user._id.toString());
      await HackathonUser.findByIdAndUpdate(user._id, { $unset: { team: 1 } });
    }
  }

  console.log(`Recalculated ${teamCount} teams. Cleared points for ${cleared.modifiedCount} users without a team.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
