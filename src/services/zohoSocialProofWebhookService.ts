import { getEnv } from '../config/env.js';
import { HackathonUser, HackathonConfig, SocialProof } from '../models/index.js';
import type { SocialPlatform } from '../models/SocialProof.js';
import { pickEmail, pickString } from './zohoWebhookService.js';
import { ApiError } from '../utils/ApiError.js';
import { SOCIAL_PLATFORM_POINTS } from './pointsService.js';

/** Default Zoho field keys when Auto-Map uses Field_1…Field_N (adjust via env if your form order differs). */
const DEFAULT_FIELD_KEYS = {
  platform: 'Field_5',
  postUrl: 'Field_7',
  screenshot: 'Field_8',
  postUrlLinkedIn: 'Field_9',
  screenshotLinkedIn: 'Field_10',
} as const;

const HTTP_URL_PATTERN = /^https?:\/\/.+/i;
const LOOSE_URL_PATTERN = /^(?:https?:\/\/)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?$/i;

function flattenFieldValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) return flattenFieldValue(obj.value);
    if ('answer' in obj) return flattenFieldValue(obj.answer);
    if ('text' in obj) return flattenFieldValue(obj.text);
    if ('url' in obj) return flattenFieldValue(obj.url);
    if ('download_url' in obj) return flattenFieldValue(obj.download_url);
    if ('file_url' in obj) return flattenFieldValue(obj.file_url);
  }
  return value;
}

function coerceToString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = coerceToString(flattenFieldValue(item));
      if (s) return s;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    return coerceToString(flattenFieldValue(value));
  }
  return undefined;
}

function pickField(data: Record<string, unknown>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  return coerceToString(data[key]);
}

function normalizePostUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (HTTP_URL_PATTERN.test(trimmed)) return trimmed;
  if (LOOSE_URL_PATTERN.test(trimmed)) {
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  }
  return undefined;
}

function normalizePlatform(raw: string | undefined): SocialPlatform | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value.includes('instagram') || value === 'ig') return 'instagram';
  if (value.includes('linkedin') || value === 'li') return 'linkedin';
  return undefined;
}

function getFieldKeys() {
  const env = getEnv();
  return {
    platform: env.ZOHO_SOCIAL_WEBHOOK_FIELD_PLATFORM?.trim() || DEFAULT_FIELD_KEYS.platform,
    postUrl: env.ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL?.trim() || DEFAULT_FIELD_KEYS.postUrl,
    screenshot: env.ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT?.trim() || DEFAULT_FIELD_KEYS.screenshot,
    postUrlLinkedIn:
      env.ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL_LINKEDIN?.trim() || DEFAULT_FIELD_KEYS.postUrlLinkedIn,
    screenshotLinkedIn:
      env.ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT_LINKEDIN?.trim() ||
      DEFAULT_FIELD_KEYS.screenshotLinkedIn,
  };
}

function pickPlatform(data: Record<string, unknown>, fieldKeys: ReturnType<typeof getFieldKeys>): SocialPlatform | undefined {
  const fromMapped = normalizePlatform(pickField(data, fieldKeys.platform));
  if (fromMapped) return fromMapped;

  const labeled = pickString(
    data,
    'Platform',
    'platform',
    'Social Platform',
    'social_platform',
    'Social platform',
    'Share Platform'
  );
  const fromLabeled = normalizePlatform(labeled);
  if (fromLabeled) return fromLabeled;

  for (const [key, value] of Object.entries(data)) {
    if (/platform|social/i.test(key)) {
      const fromKey = normalizePlatform(coerceToString(value));
      if (fromKey) return fromKey;
    }
  }

  for (const [, value] of Object.entries(data)) {
    const fromValue = normalizePlatform(coerceToString(value));
    if (fromValue) return fromValue;
  }

  const igUrl = normalizePostUrl(pickField(data, fieldKeys.postUrl) ?? '');
  const liUrl = normalizePostUrl(pickField(data, fieldKeys.postUrlLinkedIn) ?? '');
  if (igUrl && !liUrl) return 'instagram';
  if (liUrl && !igUrl) return 'linkedin';

  return undefined;
}

function collectUrlCandidates(data: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const value of Object.values(data)) {
    const s = coerceToString(flattenFieldValue(value));
    if (!s) continue;
    const normalized = normalizePostUrl(s);
    if (normalized) urls.push(normalized);
  }
  return urls;
}

function pickPostUrl(
  data: Record<string, unknown>,
  fieldKeys: ReturnType<typeof getFieldKeys>,
  platform?: SocialPlatform
): string | undefined {
  const mappedKey =
    platform === 'linkedin' && pickField(data, fieldKeys.postUrlLinkedIn)
      ? fieldKeys.postUrlLinkedIn
      : fieldKeys.postUrl;

  const fromMapped = normalizePostUrl(pickField(data, mappedKey) ?? '');
  if (fromMapped) return fromMapped;

  const labeled = pickString(
    data,
    'Post URL',
    'post_url',
    'Post Link',
    'postUrl',
    'Link',
    'link',
    'URL',
    'Public post URL'
  );
  const fromLabeled = labeled ? normalizePostUrl(labeled) : undefined;
  if (fromLabeled) return fromLabeled;

  for (const [key, value] of Object.entries(data)) {
    if (/post|link|url/i.test(key) && !/screenshot|upload|file|image/i.test(key)) {
      const candidate = normalizePostUrl(coerceToString(value) ?? '');
      if (candidate) return candidate;
    }
  }

  const candidates = collectUrlCandidates(data);
  return candidates[0];
}

function pickScreenshotUrl(
  data: Record<string, unknown>,
  fieldKeys: ReturnType<typeof getFieldKeys>,
  postUrl: string | undefined,
  platform?: SocialPlatform
): string | undefined {
  const mappedKey =
    platform === 'linkedin' && data[fieldKeys.screenshotLinkedIn] !== undefined
      ? fieldKeys.screenshotLinkedIn
      : fieldKeys.screenshot;

  const fromMapped = pickField(data, mappedKey);
  if (fromMapped) {
    const asUrl = normalizePostUrl(fromMapped);
    if (asUrl && asUrl !== postUrl) return asUrl;
    if (HTTP_URL_PATTERN.test(fromMapped)) return fromMapped;
  }

  const labeled = pickString(
    data,
    'Screenshot',
    'screenshot',
    'Screenshot URL',
    'screenshot_url',
    'Upload',
    'upload',
    'File',
    'file',
    'Image',
    'image',
    'Proof',
    'proof'
  );
  if (labeled) {
    const asUrl = normalizePostUrl(labeled) ?? (HTTP_URL_PATTERN.test(labeled) ? labeled : undefined);
    if (asUrl && asUrl !== postUrl) return asUrl;
  }

  for (const [key, value] of Object.entries(data)) {
    if (/screenshot|upload|file|image|proof|attachment/i.test(key)) {
      const candidate = coerceToString(value);
      if (!candidate) continue;
      const asUrl = normalizePostUrl(candidate) ?? (HTTP_URL_PATTERN.test(candidate) ? candidate : undefined);
      if (asUrl && asUrl !== postUrl) return asUrl;
    }
  }

  const candidates = collectUrlCandidates(data).filter((u) => u !== postUrl);
  return candidates[0];
}

interface ParsedSocialProofPayload {
  platform: SocialPlatform;
  postUrl: string;
  screenshotUrl: string;
}

function parseSocialProofPayload(data: Record<string, unknown>): ParsedSocialProofPayload {
  const fieldKeys = getFieldKeys();
  const platform = pickPlatform(data, fieldKeys);
  if (!platform) {
    throw ApiError.badRequest(
      'Platform is required (Instagram or LinkedIn). Map Field_5 or add a Platform field in Zoho Auto-Map. Received keys: ' +
        Object.keys(data).join(', ')
    );
  }

  const postUrl = pickPostUrl(data, fieldKeys, platform);
  if (!postUrl) {
    throw ApiError.badRequest(
      `Post URL is required. Expected ${fieldKeys.postUrl} or a labeled Post URL field. ` +
        'Zoho test data uses "www.example.com" — use a real submission or ensure Field_7 contains a valid URL.'
    );
  }

  try {
    new URL(postUrl);
  } catch {
    throw ApiError.badRequest('Post URL is invalid.');
  }

  const screenshotUrl = pickScreenshotUrl(data, fieldKeys, postUrl, platform);
  if (!screenshotUrl) {
    const screenshotRaw = pickField(data, fieldKeys.screenshot);
    throw ApiError.badRequest(
      `Screenshot URL is required. Expected ${fieldKeys.screenshot} with an https download link. ` +
        (screenshotRaw
          ? `Got ${fieldKeys.screenshot}="${screenshotRaw}" (filename only). Zoho "Run Test" does not send real file URLs — submit the form once for a real webhook payload.`
          : `Include ${fieldKeys.screenshot} in Auto-Map Fields.`)
    );
  }

  return { platform, postUrl, screenshotUrl };
}

export interface SocialProofWebhookResult {
  created: boolean;
  proofId: string;
  platform: SocialPlatform;
  teamId: string;
  email: string;
}

async function upsertOneSocialProof(
  user: InstanceType<typeof HackathonUser>,
  teamId: string,
  parsed: ParsedSocialProofPayload,
  zohoSubmissionId?: string
): Promise<{ proof: InstanceType<typeof SocialProof>; created: boolean }> {
  const config = await HackathonConfig.findOne({ isActive: true });
  const hashtag = config?.socialHashtag ?? '#ShipIn100Hrs';

  const existing = await SocialProof.findOne({ team: teamId, platform: parsed.platform });

  if (existing?.status === 'verified') {
    throw ApiError.conflict(`Social proof for ${parsed.platform} is already verified for this team.`);
  }

  if (!existing) {
    const proof = await SocialProof.create({
      team: teamId,
      submittedBy: user._id,
      platform: parsed.platform,
      postUrl: parsed.postUrl,
      screenshotUrl: parsed.screenshotUrl,
      hashtag,
      status: 'pending',
      source: 'zoho',
      zohoSubmissionId,
      pointsEarned: SOCIAL_PLATFORM_POINTS,
    });
    return { proof, created: true };
  }

  if (existing.status === 'pending' || existing.status === 'rejected') {
    existing.postUrl = parsed.postUrl;
    existing.screenshotUrl = parsed.screenshotUrl;
    existing.submittedBy = user._id;
    existing.hashtag = hashtag;
    existing.status = 'pending';
    existing.source = 'zoho';
    existing.zohoSubmissionId = zohoSubmissionId ?? existing.zohoSubmissionId;
    existing.verifiedAt = undefined;
    existing.verifiedBy = undefined;
    existing.pointsEarned = SOCIAL_PLATFORM_POINTS;
    await existing.save();
    return { proof: existing, created: false };
  }

  throw ApiError.conflict('Cannot update social proof in current status.');
}

export async function upsertFromZohoSocialProofWebhook(
  data: Record<string, unknown>
): Promise<SocialProofWebhookResult> {
  const email = pickEmail(data);
  if (!email) {
    const receivedKeys =
      Object.keys(data).length > 0 ? Object.keys(data).join(', ') : '(empty body)';
    throw ApiError.badRequest(
      `Email is required in webhook payload. Received keys: ${receivedKeys}. In Zoho: Payload Parameters → Form Fields → Auto-Map Fields (must include Email).`
    );
  }

  const parsed = parseSocialProofPayload(data);

  const zohoSubmissionId = pickString(
    data,
    'submission_id',
    'Submission ID',
    'record_id',
    'ID',
    'Response ID'
  );

  if (zohoSubmissionId) {
    const existingBySubmission = await SocialProof.findOne({ zohoSubmissionId });
    if (existingBySubmission) {
      return {
        created: false,
        proofId: existingBySubmission._id.toString(),
        platform: existingBySubmission.platform,
        teamId: existingBySubmission.team.toString(),
        email,
      };
    }
  }

  const user = await HackathonUser.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(
      422,
      `No hackathon account found for ${email}. User must register and use the same email as Auth0 login.`
    );
  }

  if (!user.team) {
    throw new ApiError(
      422,
      `User ${email} is not on a team yet. Join a team before submitting social share proof.`
    );
  }

  const teamId = user.team.toString();
  const { proof, created } = await upsertOneSocialProof(user, teamId, parsed, zohoSubmissionId);

  return {
    created,
    proofId: proof._id.toString(),
    platform: parsed.platform,
    teamId,
    email,
  };
}
