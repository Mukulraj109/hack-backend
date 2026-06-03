import { randomBytes } from 'crypto';
import { Team } from '../models/Team.js';

/** Avoid ambiguous characters (0/O, 1/I/L) for easier copy-paste. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCodeSegment(length: number): string {
  const bytes = randomBytes(length);
  let segment = '';
  for (let i = 0; i < length; i += 1) {
    segment += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return segment;
}

/** e.g. FST-7KXM-9P2Q — unpredictable; not sequential like FST_100_423 */
export async function generateTeamInviteCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 50) {
    const code = `FST-${randomCodeSegment(4)}-${randomCodeSegment(4)}`;
    const exists = await Team.findOne({ inviteCode: code });
    if (!exists) {
      return code;
    }
    attempts += 1;
  }
  const fallback = `FST-${randomCodeSegment(4)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  return fallback;
}
