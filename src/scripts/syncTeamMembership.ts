import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { HackathonUser, Team } from '../models/index.js';

async function main() {
  const teamIdArg = process.argv[2]?.trim();
  if (!teamIdArg) {
    console.error('Usage: tsx src/scripts/syncTeamMembership.ts <teamId>');
    process.exit(1);
  }
  if (!mongoose.Types.ObjectId.isValid(teamIdArg)) {
    console.error(`Invalid teamId: ${teamIdArg}`);
    process.exit(1);
  }

  await connectDatabase();
  const teamId = new mongoose.Types.ObjectId(teamIdArg);

  const team = await Team.findById(teamId);
  if (!team) {
    console.error(`Team not found: ${teamIdArg}`);
    process.exit(1);
  }

  const usersPointingToTeam = await HackathonUser.find({ team: teamId }).select('_id email team');
  const userIdsFromUsers = new Set(usersPointingToTeam.map((u) => u._id.toString()));

  const currentMemberIds = team.members.map((m) => m.toString());
  const mergedMemberIds = new Set<string>(currentMemberIds);
  for (const id of userIdsFromUsers) mergedMemberIds.add(id);
  mergedMemberIds.add(team.leader.toString());

  const finalMemberIds = [...mergedMemberIds].map((id) => new mongoose.Types.ObjectId(id));
  team.members = finalMemberIds as typeof team.members;
  await team.save();

  await HackathonUser.updateMany(
    { _id: { $in: finalMemberIds } },
    { $set: { team: team._id } }
  );

  const staleUsers = await HackathonUser.find({
    team: team._id,
    _id: { $nin: finalMemberIds },
  }).select('_id');
  if (staleUsers.length > 0) {
    await HackathonUser.updateMany(
      { _id: { $in: staleUsers.map((u) => u._id) } },
      { $unset: { team: 1 } }
    );
  }

  console.log('Team membership sync complete.');
  console.log(`- teamId: ${team._id.toString()}`);
  console.log(`- title: ${team.title}`);
  console.log(`- leader: ${team.leader.toString()}`);
  console.log(`- membersBefore: ${currentMemberIds.length}`);
  console.log(`- membersAfter: ${finalMemberIds.length}`);
  console.log(`- usersPointingToTeam: ${usersPointingToTeam.length}`);
  if (usersPointingToTeam.length > 0) {
    console.log(
      `- userEmailsPointingToTeam: ${usersPointingToTeam.map((u) => u.email).join(', ')}`
    );
  }
}

main()
  .catch((err) => {
    console.error('Failed to sync team membership:', err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
