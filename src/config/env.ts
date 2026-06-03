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
  SKIP_FIREBASE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
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
    SKIP_FIREBASE: process.env.SKIP_FIREBASE,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  });

  return env;
}
