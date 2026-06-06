import mongoose from 'mongoose';
import { IHackathonUser } from '../models/HackathonUser.js';
import { sendClaimPointsEmail } from '../services/zeptomailService.js';

async function main() {
  const email = process.argv[2] ?? 'mukulraj756@gmail.com';
  const firstName = process.argv[3] ?? 'Mukul';

  const user = {
    _id: new mongoose.Types.ObjectId(),
    email,
    firstName,
    lastName: '',
  } as IHackathonUser;

  console.info('[test-claim-points] Sending to', email, 'as', firstName);
  await sendClaimPointsEmail(user);
  console.info('[test-claim-points] Done');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-claim-points] Failed', err);
  process.exit(1);
});
