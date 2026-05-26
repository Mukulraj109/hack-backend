import { HackathonUser } from '../models/HackathonUser.js';
import { generateReferralCode } from '../utils/generateCode.js';

function pickString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = data[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'number') return String(val);
  }
  return undefined;
}

function pickBool(data: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const val = data[key];
    if (
      val === true ||
      val === 'true' ||
      val === 'Yes' ||
      val === 'YES' ||
      val === 'yes' ||
      val === 'Agreed'
    ) {
      return true;
    }
  }
  return false;
}

/** Zoho export uses single "Name" (e.g. "Sai, N") — split for HackathonUser */
function parseNameField(data: Record<string, unknown>): {
  firstName?: string;
  lastName?: string;
} {
  const combined = pickString(data, 'Name', 'name');
  if (combined) {
    const parts = combined.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    }
    const spaceParts = combined.trim().split(/\s+/);
    if (spaceParts.length >= 2) {
      return {
        firstName: spaceParts[0],
        lastName: spaceParts.slice(1).join(' '),
      };
    }
    return { firstName: combined };
  }
  return {
    firstName: pickString(data, 'First Name', 'FirstName', 'first_name'),
    lastName: pickString(data, 'Last Name', 'LastName', 'last_name'),
  };
}

/** Zoho "Address" often "City, ST" in one field */
function parseAddressField(data: Record<string, unknown>): { city?: string; state?: string } {
  const city = pickString(data, 'City', 'city');
  const state = pickString(data, 'State', 'state');
  if (city || state) {
    return { city, state };
  }
  const address = pickString(data, 'Address', 'address');
  if (!address) return {};
  const match = address.match(/^(.+?),\s*([A-Za-z]{2,})$/);
  if (match) {
    return { city: match[1].trim(), state: match[2].trim() };
  }
  return { city: address };
}

export function normalizeZohoPayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const raw = body as Record<string, unknown>;
  if (raw.payload && typeof raw.payload === 'object') {
    return raw.payload as Record<string, unknown>;
  }
  return raw;
}

export async function upsertFromZohoWebhook(data: Record<string, unknown>) {
  const email = pickString(data, 'Email', 'email', 'Email Address')?.toLowerCase();
  if (!email) {
    throw new Error('Email is required in webhook payload');
  }

  const { firstName, lastName } = parseNameField(data);
  const { city, state } = parseAddressField(data);
  const zohoSubmissionId = pickString(data, 'submission_id', 'Submission ID', 'record_id', 'ID');

  const update = {
    email,
    firstName,
    lastName,
    phone: pickString(data, 'Phone', 'phone'),
    city,
    state,
    linkedinUrl: pickString(data, 'LinkedIn', 'LinkedIn URL', 'linkedin'),
    githubUrl: pickString(data, 'GitHub', 'GitHub URL', 'github'),
    universityName: pickString(data, 'University Name', 'University'),
    graduationMonthYear: pickString(data, 'Graduation Month & Year', 'Graduation'),
    currentCompanyName: pickString(data, 'Current Company Name', 'Company'),
    eligibility: {
      usGraduateWindow: pickBool(
        data,
        'I graduated from a US institution within the last 7 years, or will graduate within the next 2 years',
        'us_graduate_window'
      ),
      usWorkAuthorization: pickBool(
        data,
        'I have valid work authorization in the US',
        'us_work_authorization'
      ),
      usImmigrationStatus: pickBool(
        data,
        'I have valid immigration status in the US',
        'us_immigration_status'
      ),
      age18Plus: pickBool(data, 'I am 18 years of age or older', 'age_18_plus'),
    },
    agreements: {
      hackathonRules: pickBool(data, 'I agree to the hackathon rules and code of conduct'),
      recruiterSharing: pickBool(
        data,
        'I consent to FirstSteps sharing my submission and profile with participating recruiters'
      ),
      ownWorkDuringWindow: pickBool(
        data,
        "The work I submit will be my own (or my team's), built during the hackathon window"
      ),
      confirmationYes: pickBool(
        data,
        'YES',
        'yes_confirmation',
        'Quick eligibility check'
      ),
      termsAccepted: pickBool(data, 'Terms and Conditions', 'terms_accepted'),
      signatureConfirmed: pickBool(data, 'Signature', 'signature_confirmed'),
    },
    accountStatus: 'pending' as const,
    registrationCompletedAt: new Date(),
    ...(zohoSubmissionId ? { zohoSubmissionId } : {}),
  };

  const existing = await HackathonUser.findOne({ email });

  if (existing) {
    Object.assign(existing, update);
    if (!existing.referralCode) {
      existing.referralCode = generateReferralCode(firstName || email);
    }
    await existing.save();
    return { user: existing, created: false };
  }

  const user = await HackathonUser.create({
    ...update,
    referralCode: generateReferralCode(firstName || email),
  });

  return { user, created: true };
}
