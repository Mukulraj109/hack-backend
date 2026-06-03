import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { HackathonUser, Team } from '../models/index.js';

async function main() {
  const emailArg = process.argv[2]?.trim().toLowerCase();
  if (!emailArg) {
    console.error('Usage: tsx src/scripts/deleteTeamByEmail.ts <email>');
    process.exit(1);
  }

  await connectDatabase();

  const user = await HackathonUser.findOne({ email: emailArg });
  if (!user) {
    console.log(`No hackathon user found for email: ${emailArg}`);
    return;
  }

  if (!user.team) {
    console.log(`User ${emailArg} is not on any team. Nothing to delete.`);
    return;
  }

  const team = await Team.findById(user.team);
  if (!team) {
    await HackathonUser.updateOne({ _id: user._id }, { $unset: { team: 1 } });
    console.log(`Team reference removed for ${emailArg}; team record did not exist.`);
    return;
  }

  const memberIds = team.members.map((m) => m.toString());
  await HackathonUser.updateMany({ _id: { $in: memberIds } }, { $unset: { team: 1 } });
  await Team.deleteOne({ _id: team._id });

  console.log('Deleted team successfully.');
  console.log(`- email: ${emailArg}`);
  console.log(`- teamId: ${team._id.toString()}`);
  console.log(`- teamTitle: ${team.title}`);
  console.log(`- membersUpdated: ${memberIds.length}`);
}

main()
  .catch((err) => {
    console.error('Failed to delete team by email:', err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
