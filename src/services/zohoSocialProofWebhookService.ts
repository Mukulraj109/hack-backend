import { getEnv } from '../config/env.js';
import { HackathonUser, HackathonConfig, SocialProof } from '../models/index.js';
import type { SocialPlatform } from '../models/SocialProof.js';
import { pickEmail, pickString } from './zohoWebhookService.js';
import { ApiError } from '../utils/ApiError.js';
import { SOCIAL_PLATFORM_POINTS } from './pointsService.js';

/**
 * Claim Your Viral Points form layout (no Platform dropdown):
 * - Field_7 / Field_8  → LinkedIn post link + screenshot
 * - Field_9 / Field_10 → Instagram profile/post link + screenshot
 */
const DEFAULT_PLATFORM_BLOCKS = {
  linkedin: { postUrl: 'Field_7', screenshot: 'Field_8' },
  instagram: { postUrl: 'Field_9', screenshot: 'Field_10' },
} as const;

const LABELED_PLATFORM_BLOCKS: Record<
  SocialPlatform,
  { postUrl: string[]; screenshot: string[] }
> = {
  linkedin: {
    postUrl: ['LinkedIn Post Link', 'Linkedin Post Link', 'linkedin_post_link'],
    screenshot: ['Linkedin Post Upload', 'LinkedIn Post Upload', 'linkedin_post_upload'],
  },
  instagram: {
    postUrl: ['Instagram Profile Link', 'Instagram Post Link', 'instagram_profile_link'],
    screenshot: ['Instagram Post Upload', 'instagram_post_upload'],
  },
};

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

function pickFirstField(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = pickField(data, key);
    if (value) return value;
  }
  return undefined;
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

interface PlatformBlockKeys {
  postUrl: string;
  screenshot: string;
}

function getPlatformBlockKeys(): Record<SocialPlatform, PlatformBlockKeys> {
  const env = getEnv();
  return {
    linkedin: {
      postUrl:
        env.ZOHO_SOCIAL_WEBHOOK_FIELD_LINKEDIN_POST_URL?.trim() ||
        env.ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL?.trim() ||
        DEFAULT_PLATFORM_BLOCKS.linkedin.postUrl,
      screenshot:
        env.ZOHO_SOCIAL_WEBHOOK_FIELD_LINKEDIN_SCREENSHOT?.trim() ||
        env.ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT?.trim() ||
        DEFAULT_PLATFORM_BLOCKS.linkedin.screenshot,
    },
    instagram: {
      postUrl:
        env.ZOHO_SOCIAL_WEBHOOK_FIELD_INSTAGRAM_POST_URL?.trim() ||
        env.ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL_LINKEDIN?.trim() ||
        DEFAULT_PLATFORM_BLOCKS.instagram.postUrl,
      screenshot:
        env.ZOHO_SOCIAL_WEBHOOK_FIELD_INSTAGRAM_SCREENSHOT?.trim() ||
        env.ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT_LINKEDIN?.trim() ||
        DEFAULT_PLATFORM_BLOCKS.instagram.screenshot,
    },
  };
}

function pickScreenshotUrl(raw: string | undefined, postUrl: string): string | undefined {
  if (!raw) return undefined;
  const asUrl = normalizePostUrl(raw);
  if (asUrl && asUrl !== postUrl) return asUrl;
  if (HTTP_URL_PATTERN.test(raw) && raw !== postUrl) return raw;
  return undefined;
}

interface ParsedSocialProofPayload {
  platform: SocialPlatform;
  postUrl: string;
  screenshotUrl: string;
}

function parsePlatformBlock(
  data: Record<string, unknown>,
  platform: SocialPlatform,
  keys: PlatformBlockKeys
): ParsedSocialProofPayload | undefined {
  const labeled = LABELED_PLATFORM_BLOCKS[platform];
  const postUrlRaw =
    pickField(data, keys.postUrl) ?? pickFirstField(data, labeled.postUrl);
  const postUrl = postUrlRaw ? normalizePostUrl(postUrlRaw) : undefined;
  if (!postUrl) return undefined;

  try {
    new URL(postUrl);
  } catch {
    throw ApiError.badRequest(`${platform} post URL is invalid (${keys.postUrl}).`);
  }

  const screenshotRaw =
    pickField(data, keys.screenshot) ?? pickFirstField(data, labeled.screenshot);
  const screenshotUrl = pickScreenshotUrl(screenshotRaw, postUrl);
  if (!screenshotUrl) {
    throw ApiError.badRequest(
      `${platform} screenshot URL is required (${keys.screenshot}).` +
        (screenshotRaw
          ? ` Got "${screenshotRaw}" (filename only). Zoho "Run Test" does not send real file URLs — submit the form once for a real webhook payload.`
          : ` Upload a screenshot in the ${platform} section of the form.`)
    );
  }

  return { platform, postUrl, screenshotUrl };
}

function parseSocialProofPayloads(data: Record<string, unknown>): ParsedSocialProofPayload[] {
  const blocks = getPlatformBlockKeys();
  const parsed: ParsedSocialProofPayload[] = [];
  const errors: string[] = [];

  for (const platform of ['linkedin', 'instagram'] as const) {
    try {
      const block = parsePlatformBlock(data, platform, blocks[platform]);
      if (block) parsed.push(block);
    } catch (err) {
      const keys = blocks[platform];
      const postUrlRaw = pickField(data, keys.postUrl);
      if (postUrlRaw) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (parsed.length > 0) return parsed;

  if (errors.length > 0) {
    throw ApiError.badRequest(errors.join(' '));
  }

  const env = getEnv();
  const platformField = env.ZOHO_SOCIAL_WEBHOOK_FIELD_PLATFORM?.trim();
  const legacyPlatform = normalizePlatform(platformField ? pickField(data, platformField) : undefined);
  if (legacyPlatform) {
    const block = parsePlatformBlock(data, legacyPlatform, blocks[legacyPlatform]);
    if (block) return [block];
  }

  throw ApiError.badRequest(
    'At least one platform section is required. Fill LinkedIn (Field_7 + Field_8) and/or Instagram (Field_9 + Field_10). ' +
      'This form has no Platform dropdown — the backend detects platform from which section you filled. Received keys: ' +
      Object.keys(data).join(', ')
  );
}

export interface SocialProofWebhookProofResult {
  created: boolean;
  proofId: string;
  platform: SocialPlatform;
}

export interface SocialProofWebhookResult {
  email: string;
  teamId: string;
  proofs: SocialProofWebhookProofResult[];
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

  const parsedPayloads = parseSocialProofPayloads(data);

  const zohoSubmissionId = pickString(
    data,
    'submission_id',
    'Submission ID',
    'record_id',
    'ID',
    'Response ID'
  );

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
  const proofs: SocialProofWebhookProofResult[] = [];

  for (const parsed of parsedPayloads) {
    const submissionKey = zohoSubmissionId
      ? `${zohoSubmissionId}:${parsed.platform}`
      : undefined;

    if (submissionKey) {
      const existingBySubmission = await SocialProof.findOne({ zohoSubmissionId: submissionKey });
      if (existingBySubmission) {
        proofs.push({
          created: false,
          proofId: existingBySubmission._id.toString(),
          platform: existingBySubmission.platform,
        });
        continue;
      }
    }

    const { proof, created } = await upsertOneSocialProof(
      user,
      teamId,
      parsed,
      submissionKey
    );
    proofs.push({
      created,
      proofId: proof._id.toString(),
      platform: parsed.platform,
    });
  }

  return { email, teamId, proofs };
}
