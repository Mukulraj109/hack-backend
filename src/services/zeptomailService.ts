import { SendMailClient } from 'zeptomail';
import { getEnv } from '../config/env.js';
import { IHackathonUser } from '../models/HackathonUser.js';

export const DEFAULT_ZEPTOMAIL_FROM_ADDRESS = 'noreply@firststepjob.com';
export const DEFAULT_ZEPTOMAIL_FROM_NAME = 'FirstStep';

const ZEPTOMAIL_URL = 'https://api.zeptomail.in/v1.1/email/template';

let client: SendMailClient | null = null;

function getClient(): SendMailClient {
  const env = getEnv();
  if (!client) {
    client = new SendMailClient({
      url: ZEPTOMAIL_URL,
      token: env.ZEPTOMAIL_API_TOKEN!,
    });
  }
  return client;
}

function hasZeptoMailToken(): boolean {
  return Boolean(getEnv().ZEPTOMAIL_API_TOKEN?.trim());
}

function resolveFromAddress(): string {
  const env = getEnv();
  return env.ZEPTOMAIL_FROM_ADDRESS?.trim() || DEFAULT_ZEPTOMAIL_FROM_ADDRESS;
}

function resolveFromName(): string {
  const env = getEnv();
  const name = env.ZEPTOMAIL_FROM_NAME?.trim();
  return name || DEFAULT_ZEPTOMAIL_FROM_NAME;
}

function displayName(user: IHackathonUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email;
}

function resolveFirstName(user: IHackathonUser): string {
  if (user.firstName?.trim()) return user.firstName.trim();
  const fromFullName = displayName(user);
  if (fromFullName && fromFullName !== user.email) {
    return fromFullName.split(/\s+/)[0] ?? '';
  }
  return user.email.split('@')[0] ?? '';
}

function resolveLastName(user: IHackathonUser): string {
  if (user.lastName?.trim()) return user.lastName.trim();
  const fromFullName = displayName(user);
  if (fromFullName && fromFullName !== user.email) {
    const parts = fromFullName.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }
  return '';
}

function compactName(user: IHackathonUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join('').trim();
}

function resolveToDisplayName(user: IHackathonUser): string {
  const full = displayName(user);
  if (full && full !== user.email) return full;
  return compactName(user) || resolveFirstName(user);
}

/** Flat string merge_info — templates use Mustache tags like {{name_firstname}}. */
export function buildNameMergeInfo(user: IHackathonUser): Record<string, string> {
  const firstname = resolveFirstName(user);
  const lastname = resolveLastName(user);
  const fullName = displayName(user);

  const mergeInfo: Record<string, string> = {
    name_firstname: firstname,
    name_lastname: lastname,
    'name.firstname': firstname,
    'name.lastname': lastname,
    firstname,
    lastname,
    name: fullName,
    user_name: fullName,
    user_email: user.email,
  };

  const compact = compactName(user);
  if (compact) mergeInfo.name_compact = compact;
  if (firstname) mergeInfo.user_given_name = firstname;
  if (lastname) mergeInfo.user_family_name = lastname;

  const customKey = getEnv().ZEPTOMAIL_APPROVAL_MERGE_FIRSTNAME_KEY?.trim();
  if (customKey) mergeInfo[customKey] = firstname;

  return mergeInfo;
}

export interface ScoreUpdateMergeInput {
  previousScore: number;
  newScore: number;
  pointsGained: number;
  reason: string;
  dashboardUrl: string;
}

export function buildScoreUpdateMergeInfo(
  user: IHackathonUser,
  input: ScoreUpdateMergeInput
): Record<string, string> {
  const pointsGained = String(input.pointsGained);
  return {
    ...buildNameMergeInfo(user),
    previous_score: String(input.previousScore),
    new_score: String(input.newScore),
    points_gained: pointsGained,
    POINTS_GAINED: pointsGained,
    score_change_reason: input.reason,
    dashboard_url: input.dashboardUrl,
  };
}

async function sendTemplateEmail(
  user: IHackathonUser,
  templateKey: string,
  merge_info: Record<string, string>,
  label: string
): Promise<void> {
  if (!hasZeptoMailToken()) {
    console.warn(`[zeptomail] Skipping ${label} — ZeptoMail not configured`);
    return;
  }

  const from = {
    address: resolveFromAddress(),
    name: resolveFromName(),
  };
  const toDisplayName = resolveToDisplayName(user);

  const payload = {
    template_key: templateKey,
    from,
    to: [
      {
        email_address: {
          address: user.email,
          ...(toDisplayName ? { name: toDisplayName } : {}),
        },
      },
    ],
    merge_info,
  };

  try {
    const response = await getClient().sendMailWithTemplate(payload);
    console.info(`[zeptomail] ${label} sent`, {
      userId: user._id.toString(),
      email: user.email,
      from,
      merge_info,
      response,
    });
  } catch (err) {
    console.error(`[zeptomail] ${label} failed`, {
      userId: user._id.toString(),
      from,
      merge_info,
      payload,
      err,
    });
    throw err;
  }
}

export async function sendApprovalEmail(user: IHackathonUser): Promise<void> {
  const env = getEnv();
  if (!env.ZEPTOMAIL_APPROVAL_TEMPLATE_KEY?.trim()) {
    console.warn('[zeptomail] Skipping approval email — template key not configured');
    return;
  }

  await sendTemplateEmail(
    user,
    env.ZEPTOMAIL_APPROVAL_TEMPLATE_KEY,
    buildNameMergeInfo(user),
    'Approval email'
  );
}

export async function sendTeamReminderEmail(user: IHackathonUser): Promise<void> {
  const env = getEnv();
  if (!env.ZEPTOMAIL_TEAM_REMINDER_TEMPLATE_KEY?.trim()) {
    console.warn('[zeptomail] Skipping team reminder — template key not configured');
    return;
  }

  await sendTemplateEmail(
    user,
    env.ZEPTOMAIL_TEAM_REMINDER_TEMPLATE_KEY,
    buildNameMergeInfo(user),
    'Team reminder email'
  );
}

export async function sendClaimPointsEmail(user: IHackathonUser): Promise<void> {
  const env = getEnv();
  if (!env.ZEPTOMAIL_CLAIM_POINTS_TEMPLATE_KEY?.trim()) {
    console.warn('[zeptomail] Skipping claim points email — template key not configured');
    return;
  }

  await sendTemplateEmail(
    user,
    env.ZEPTOMAIL_CLAIM_POINTS_TEMPLATE_KEY,
    buildNameMergeInfo(user),
    'Claim points email'
  );
}

export async function sendScoreUpdateEmail(
  user: IHackathonUser,
  scoreMergeInfo: Record<string, string>
): Promise<void> {
  const env = getEnv();
  if (!env.ZEPTOMAIL_SCORE_UPDATE_TEMPLATE_KEY?.trim()) {
    console.warn('[zeptomail] Skipping score update email — template key not configured');
    return;
  }

  await sendTemplateEmail(
    user,
    env.ZEPTOMAIL_SCORE_UPDATE_TEMPLATE_KEY,
    scoreMergeInfo,
    'Score update email'
  );
}
