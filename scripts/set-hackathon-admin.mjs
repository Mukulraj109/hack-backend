import mongoose from 'mongoose';

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error('Usage: node scripts/set-hackathon-admin.mjs <email>');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const col = mongoose.connection.collection('hackathon_users');

const result = await col.updateOne({ email }, { $set: { isAdmin: true } });
const user = await col.findOne(
  { email },
  { projection: { email: 1, isAdmin: 1, firstName: 1, lastName: 1, accountStatus: 1 } }
);

console.log(
  JSON.stringify(
    {
      email,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      user: user ?? null,
      note:
        result.matchedCount === 0
          ? 'No hackathon_users document found for this email.'
          : 'Done. Log out and back in to refresh admin access.',
    },
    null,
    2
  )
);

await mongoose.disconnect();
