import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('5000'),
  MONGODB_URI: z.string(),
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MAX_FILE_SIZE: z.string().default('262144000'),
  AUTH0_DOMAIN: z.string(),
  AUTH0_CLIENT_ID: z.string(),
  /** Dev: Auth0 Management API audience. Prod: omit (ID token aud = SPA client id). */
  AUTH0_AUDIENCE: z.string().optional(),
  USERMANAGEMENT_API_CLIENT_ID: z.string().optional(),
  USERMANAGEMENT_API_CLIENT_SECRET: z.string().optional(),
  USERMANAGEMENT_API_CLIENT_AUDIENCE: z.string().optional(),
  USERMANAGEMENT_API_AUTH0_DOMAIN: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ZOHO_WEBHOOK_SECRET: z.string().optional(),
  /** Server-only Zoho hackathon registration form permalink (never expose to frontend). */
  ZOHO_REGISTRATION_FORM_URL: z.string().optional(),
  /** Server-only Zoho hackathon follow form permalink (never expose to frontend). */
  ZOHO_FOLLOW_FORM_URL: z.string().optional(),
  /** Server-only Zoho hiring partner form permalink (never expose to frontend). */
  ZOHO_HIRING_PARTNER_FORM_URL: z.string().optional(),
  /** Server-only Zoho information session form permalink (never expose to frontend). */
  ZOHO_INFO_SESSION_FORM_URL: z.string().optional(),
  /** Server-only Zoho social share verification form (Instagram / LinkedIn). */
  ZOHO_SOCIAL_SHARE_FORM_URL: z.string().optional(),
  /** Zoho webhook payload keys — dual-platform form (see ZOHO-WEBHOOK-SETUP.md). */
  ZOHO_SOCIAL_WEBHOOK_FIELD_LINKEDIN_POST_URL: z.string().optional(),
  ZOHO_SOCIAL_WEBHOOK_FIELD_LINKEDIN_SCREENSHOT: z.string().optional(),
  ZOHO_SOCIAL_WEBHOOK_FIELD_INSTAGRAM_POST_URL: z.string().optional(),
  ZOHO_SOCIAL_WEBHOOK_FIELD_INSTAGRAM_SCREENSHOT: z.string().optional(),
  /** Legacy aliases (still supported). */
  ZOHO_SOCIAL_WEBHOOK_FIELD_PLATFORM: z.string().optional(),
  ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL: z.string().optional(),
  ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT: z.string().optional(),
  ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL_LINKEDIN: z.string().optional(),
  ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT_LINKEDIN: z.string().optional(),
  SKIP_FIREBASE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  /** ZeptoMail API token (include Zoho-enczapikey prefix). */
  ZEPTOMAIL_API_TOKEN: z.string().optional(),
  /** ZeptoMail template key for registration approval emails. */
  ZEPTOMAIL_APPROVAL_TEMPLATE_KEY: z.string().optional(),
  /** Optional exact merge_info key from template Merge info tab (e.g. name_firstname). */
  ZEPTOMAIL_APPROVAL_MERGE_FIRSTNAME_KEY: z.string().optional(),
  ZEPTOMAIL_FROM_ADDRESS: z.string().default('noreply@firststepjob.com'),
  ZEPTOMAIL_FROM_NAME: z
    .string()
    .optional()
    .transform((v) => v?.trim() || 'FirstStep')
    .default('FirstStep'),
  /** ZeptoMail template key for team reminder emails. */
  ZEPTOMAIL_TEAM_REMINDER_TEMPLATE_KEY: z
    .string()
    .default(
      '2518b.354647c12fb35c26.k1.db199020-61b0-11f1-aab5-525400c92439.19e9d415222'
    ),
  TEAM_REMINDER_CRON_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0')
    .default('true'),
  TEAM_REMINDER_CRON_SCHEDULE: z.string().default('0 10 * * *'),
  TEAM_REMINDER_MIN_HOURS_AFTER_ACTIVE: z.string().default('48').transform(Number),
  TEAM_REMINDER_MIN_HOURS_BETWEEN_SENDS: z.string().default('24').transform(Number),
  /** ZeptoMail template key for claim 50 points emails. */
  ZEPTOMAIL_CLAIM_POINTS_TEMPLATE_KEY: z
    .string()
    .default(
      '2518b.354647c12fb35c26.k1.099f4870-61b3-11f1-9e57-d2cf08f4ca8c.19e9d4f9e77'
    ),
  CLAIM_POINTS_REMINDER_CRON_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0')
    .default('true'),
  CLAIM_POINTS_REMINDER_CRON_SCHEDULE: z.string().default('0 11 * * *'),
  CLAIM_POINTS_REMINDER_MIN_HOURS_BETWEEN_SENDS: z.string().default('24').transform(Number),
  /** ZeptoMail template key for hackathon score update emails. */
  ZEPTOMAIL_SCORE_UPDATE_TEMPLATE_KEY: z
    .string()
    .default(
      '2518b.354647c12fb35c26.k1.192cda92-61b9-11f1-9e57-d2cf08f4ca8c.19e9d7756b9'
    ),
  /** Sprint dashboard URL for score update email CTA. Defaults to first CORS_ORIGIN + /sprint. */
  HACKATHON_DASHBOARD_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (env) return env;

  env = envSchema.parse({
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
    USERMANAGEMENT_API_CLIENT_ID: process.env.USERMANAGEMENT_API_CLIENT_ID,
    USERMANAGEMENT_API_CLIENT_SECRET: process.env.USERMANAGEMENT_API_CLIENT_SECRET,
    USERMANAGEMENT_API_CLIENT_AUDIENCE: process.env.USERMANAGEMENT_API_CLIENT_AUDIENCE,
    USERMANAGEMENT_API_AUTH0_DOMAIN: process.env.USERMANAGEMENT_API_AUTH0_DOMAIN,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    ZOHO_WEBHOOK_SECRET: process.env.ZOHO_WEBHOOK_SECRET,
    ZOHO_REGISTRATION_FORM_URL: process.env.ZOHO_REGISTRATION_FORM_URL,
    ZOHO_FOLLOW_FORM_URL: process.env.ZOHO_FOLLOW_FORM_URL,
    ZOHO_HIRING_PARTNER_FORM_URL: process.env.ZOHO_HIRING_PARTNER_FORM_URL,
    ZOHO_INFO_SESSION_FORM_URL: process.env.ZOHO_INFO_SESSION_FORM_URL,
    ZOHO_SOCIAL_SHARE_FORM_URL: process.env.ZOHO_SOCIAL_SHARE_FORM_URL,
    ZOHO_SOCIAL_WEBHOOK_FIELD_LINKEDIN_POST_URL:
      process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_LINKEDIN_POST_URL,
    ZOHO_SOCIAL_WEBHOOK_FIELD_LINKEDIN_SCREENSHOT:
      process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_LINKEDIN_SCREENSHOT,
    ZOHO_SOCIAL_WEBHOOK_FIELD_INSTAGRAM_POST_URL:
      process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_INSTAGRAM_POST_URL,
    ZOHO_SOCIAL_WEBHOOK_FIELD_INSTAGRAM_SCREENSHOT:
      process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_INSTAGRAM_SCREENSHOT,
    ZOHO_SOCIAL_WEBHOOK_FIELD_PLATFORM: process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_PLATFORM,
    ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL: process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL,
    ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT: process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT,
    ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL_LINKEDIN:
      process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_POST_URL_LINKEDIN,
    ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT_LINKEDIN:
      process.env.ZOHO_SOCIAL_WEBHOOK_FIELD_SCREENSHOT_LINKEDIN,
    SKIP_FIREBASE: process.env.SKIP_FIREBASE,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    ZEPTOMAIL_API_TOKEN: process.env.ZEPTOMAIL_API_TOKEN,
    ZEPTOMAIL_APPROVAL_TEMPLATE_KEY: process.env.ZEPTOMAIL_APPROVAL_TEMPLATE_KEY,
    ZEPTOMAIL_APPROVAL_MERGE_FIRSTNAME_KEY: process.env.ZEPTOMAIL_APPROVAL_MERGE_FIRSTNAME_KEY,
    ZEPTOMAIL_FROM_ADDRESS: process.env.ZEPTOMAIL_FROM_ADDRESS,
    ZEPTOMAIL_FROM_NAME: process.env.ZEPTOMAIL_FROM_NAME,
    ZEPTOMAIL_TEAM_REMINDER_TEMPLATE_KEY: process.env.ZEPTOMAIL_TEAM_REMINDER_TEMPLATE_KEY,
    TEAM_REMINDER_CRON_ENABLED: process.env.TEAM_REMINDER_CRON_ENABLED,
    TEAM_REMINDER_CRON_SCHEDULE: process.env.TEAM_REMINDER_CRON_SCHEDULE,
    TEAM_REMINDER_MIN_HOURS_AFTER_ACTIVE: process.env.TEAM_REMINDER_MIN_HOURS_AFTER_ACTIVE,
    TEAM_REMINDER_MIN_HOURS_BETWEEN_SENDS: process.env.TEAM_REMINDER_MIN_HOURS_BETWEEN_SENDS,
    ZEPTOMAIL_CLAIM_POINTS_TEMPLATE_KEY: process.env.ZEPTOMAIL_CLAIM_POINTS_TEMPLATE_KEY,
    CLAIM_POINTS_REMINDER_CRON_ENABLED: process.env.CLAIM_POINTS_REMINDER_CRON_ENABLED,
    CLAIM_POINTS_REMINDER_CRON_SCHEDULE: process.env.CLAIM_POINTS_REMINDER_CRON_SCHEDULE,
    CLAIM_POINTS_REMINDER_MIN_HOURS_BETWEEN_SENDS:
      process.env.CLAIM_POINTS_REMINDER_MIN_HOURS_BETWEEN_SENDS,
    ZEPTOMAIL_SCORE_UPDATE_TEMPLATE_KEY: process.env.ZEPTOMAIL_SCORE_UPDATE_TEMPLATE_KEY,
    HACKATHON_DASHBOARD_URL: process.env.HACKATHON_DASHBOARD_URL,
  });

  return env;
}
