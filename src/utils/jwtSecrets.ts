import { getEnv } from '../config/env.js';
import { ApiError } from './ApiError.js';

export function getJwtSecret(): string {
  const secret = getEnv().JWT_SECRET;
  if (!secret) {
    throw ApiError.internal('JWT_SECRET is not configured');
  }
  return secret;
}

export function getJwtRefreshSecret(): string {
  const secret = getEnv().JWT_REFRESH_SECRET;
  if (!secret) {
    throw ApiError.internal('JWT_REFRESH_SECRET is not configured');
  }
  return secret;
}
