import { HackathonUser } from '../models/HackathonUser.js';
import { generateReferralCode } from '../utils/generateCode.js';
import { ApiError } from '../utils/ApiError.js';
function coerceToString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = coerceToString(item);
      if (s) return s;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    return coerceToString(flattenFieldValue(value));
  }
  return undefined;
}

export function pickString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = coerceToString(data[key]);
    if (val) return val;
  }
  return undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function looksLikeEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function sortedFieldEntries(data: Record<string, unknown>): [string, unknown][] {
  return Object.entries(data).sort(([a], [b]) => {
    const numA = /^Field_(\d+)$/i.exec(a)?.[1];
    const numB = /^Field_(\d+)$/i.exec(b)?.[1];
    if (numA && numB) return Number(numA) - Number(numB);
    return a.localeCompare(b);
  });
}

/** Zoho Auto-Map, labeled fields, or generic Field_1…Field_N (incl. test webhook). */
export function pickEmail(data: Record<string, unknown>): string | undefined {
  const direct = pickString(
    data,
    'Email',
    'email',
    'Email Address',
    'email_address',
    'E-mail',
    'E-Mail'
  );
  if (direct) return direct.toLowerCase();

  for (const [key, value] of Object.entries(data)) {
    if (/email/i.test(key)) {
      const s = coerceToString(value);
      if (s) return s.toLowerCase();
    }
  }

  // Zoho "Test Webhook" sample uses Field_3, Field_24, etc. — use first email in field order
  for (const [, value] of sortedFieldEntries(data)) {
    const s = coerceToString(value);
    if (s && looksLikeEmail(s)) return s.toLowerCase();
  }

  return undefined;
}

function hasGenericFieldKeys(data: Record<string, unknown>): boolean {
  return Object.keys(data).some((k) => /^Field_\d+$/i.test(k));
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

function splitCombinedName(combined: string): { firstName?: string; lastName?: string } {
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

/** Zoho export uses single "Name" (e.g. "Sai, N") — split for HackathonUser */
function parseNameField(data: Record<string, unknown>): {
  firstName?: string;
  lastName?: string;
} {
  const combined = pickString(
    data,
    'Name',
    'name',
    'Full Name',
    'full_name',
    'FULL_NAME',
    'Your Name',
    'your_name',
    'Participant Name',
    'participant_name'
  );
  if (combined) {
    return splitCombinedName(combined);
  }

  const firstName = pickString(
    data,
    'First Name',
    'FirstName',
    'first_name',
    'Given Name',
    'given_name'
  );
  const lastName = pickString(
    data,
    'Last Name',
    'LastName',
    'last_name',
    'Family Name',
    'family_name',
    'Surname',
    'surname'
  );
  if (firstName || lastName) {
    return { firstName, lastName };
  }

  // Any Auto-Map key containing "name" (e.g. "Legal Name") except company/university fields
  for (const [key, value] of Object.entries(data)) {
    if (!/name/i.test(key) || /company|university|team|user|email/i.test(key)) continue;
    const s = coerceToString(value);
    if (!s || looksLikeEmail(s)) continue;
    return splitCombinedName(s);
  }

  // Zoho sample / unmapped webhooks: Field_1 = first name, Field_2 = last name
  if (hasGenericFieldKeys(data)) {
    const f1 = pickString(data, 'Field_1');
    const f2 = pickString(data, 'Field_2');
    if (f1 && f2 && !looksLikeEmail(f1) && !looksLikeEmail(f2)) {
      return { firstName: f1, lastName: f2 };
    }
    if (f1 && !looksLikeEmail(f1)) return { firstName: f1 };
  }

  return {};
}

function applyParsedName(
  target: { firstName?: string; lastName?: string },
  parsed: { firstName?: string; lastName?: string }
): void {
  if (parsed.firstName?.trim()) {
    target.firstName = parsed.firstName.trim();
  }
  if (parsed.lastName?.trim()) {
    target.lastName = parsed.lastName.trim();
  }
}

/** Zoho "Address" often "City, ST" in one field */
function parseAddressField(data: Record<string, unknown>): { city?: string; state?: string } {
  const city = pickString(data, 'City', 'city');
  const state = pickString(data, 'State', 'state');
  if (city || state) {
    return { city, state };
  }
  const address = pickString(data, 'Address', 'address');
  if (!address) {
    if (hasGenericFieldKeys(data)) {
      return {
        city: pickString(data, 'Field_5'),
        state: pickString(data, 'Field_6'),
      };
    }
    return {};
  }
  const match = address.match(/^(.+?),\s*([A-Za-z]{2,})$/);
  if (match) {
    return { city: match[1].trim(), state: match[2].trim() };
  }
  return { city: address };
}

function pickAgreementValue(data: Record<string, unknown>, ...keys: string[]): boolean {
  if (pickBool(data, ...keys)) return true;
  for (const [, value] of Object.entries(data)) {
    const s = coerceToString(value);
    if (s === 'Agreed' || s === 'YES' || s === 'Yes') return true;
  }
  return false;
}

function flattenFieldValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) return flattenFieldValue(obj.value);
    if ('answer' in obj) return flattenFieldValue(obj.answer);
    if ('text' in obj) return flattenFieldValue(obj.text);
  }
  return value;
}

function flattenZohoRecord(record: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    flat[key] = flattenFieldValue(value);
  }
  return flat;
}

/** Unwrap common Zoho Forms / CRM webhook body shapes into flat field map. */
export function normalizeZohoPayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const raw = body as Record<string, unknown>;
  const nested =
    (raw.payload && typeof raw.payload === 'object' ? raw.payload : null) ??
    (raw.data && typeof raw.data === 'object' ? raw.data : null) ??
    (raw.form_data && typeof raw.form_data === 'object' ? raw.form_data : null);
  if (nested && typeof nested === 'object') {
    return flattenZohoRecord(nested as Record<string, unknown>);
  }
  return flattenZohoRecord(raw);
}

export async function upsertFromZohoWebhook(data: Record<string, unknown>) {
  const email = pickEmail(data);
  if (!email) {
    const receivedKeys =
      Object.keys(data).length > 0 ? Object.keys(data).join(', ') : '(empty body)';
    throw ApiError.badRequest(
      `Email is required in webhook payload. Received keys: ${receivedKeys}. In Zoho: Payload Parameters → Form Fields → Auto-Map Fields (must include Email).`
    );
  }

  const parsedName = parseNameField(data);
  const { city, state } = parseAddressField(data);
  const zohoSubmissionId = pickString(data, 'submission_id', 'Submission ID', 'record_id', 'ID');

  const update = {
    email,
    phone:
      pickString(data, 'Phone', 'phone') ??
      (hasGenericFieldKeys(data) ? pickString(data, 'Field_4') : undefined),
    city,
    state,
    linkedinUrl:
      pickString(data, 'LinkedIn', 'LinkedIn URL', 'linkedin') ??
      (hasGenericFieldKeys(data) ? pickString(data, 'Field_7') : undefined),
    githubUrl:
      pickString(data, 'GitHub', 'GitHub URL', 'github') ??
      (hasGenericFieldKeys(data) ? pickString(data, 'Field_8') : undefined),
    universityName:
      pickString(data, 'University Name', 'University') ??
      (hasGenericFieldKeys(data) ? pickString(data, 'Field_9') : undefined),
    graduationMonthYear:
      pickString(data, 'Graduation Month & Year', 'Graduation') ??
      (hasGenericFieldKeys(data) ? pickString(data, 'Field_10') : undefined),
    currentCompanyName:
      pickString(data, 'Current Company Name', 'Company') ??
      (hasGenericFieldKeys(data) ? pickString(data, 'Field_11') : undefined),
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
      termsAccepted: pickAgreementValue(data, 'Terms and Conditions', 'terms_accepted'),
      signatureConfirmed: pickBool(data, 'Signature', 'signature_confirmed'),
    },
    accountStatus: 'pending' as const,
    registrationCompletedAt: new Date(),
    ...(zohoSubmissionId ? { zohoSubmissionId } : {}),
  };

  const existing = await HackathonUser.findOne({ email });

  if (existing) {
    Object.assign(existing, update);
    applyParsedName(existing, parsedName);
    if (!existing.referralCode) {
      existing.referralCode = generateReferralCode(parsedName.firstName || email);
    }
    await existing.save();
    return { user: existing, created: false };
  }

  const user = new HackathonUser({
    ...update,
    referralCode: generateReferralCode(parsedName.firstName || email),
  });
  applyParsedName(user, parsedName);
  await user.save();

  return { user, created: true };
}
