import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizeZohoPayload, upsertFromZohoWebhook } from '../services/zohoWebhookService.js';
import { upsertFromZohoSocialProofWebhook } from '../services/zohoSocialProofWebhookService.js';

function assertZohoWebhookSecret(req: Request): void {
  const env = getEnv();
  if (!env.ZOHO_WEBHOOK_SECRET) return;

  const headerSecret =
    req.headers['x-zoho-secret'] ||
    req.headers['x-webhook-secret'] ||
    req.query.secret;
  if (headerSecret !== env.ZOHO_WEBHOOK_SECRET) {
    throw ApiError.unauthorized('Invalid webhook secret');
  }
}

export const zohoRegistrationWebhook = asyncHandler(async (req: Request, res: Response) => {
  assertZohoWebhookSecret(req);

  const data = normalizeZohoPayload(req.body);
  const result = await upsertFromZohoWebhook(data);

  res.json({
    success: true,
    message: result.created ? 'Registration created' : 'Registration updated',
    data: {
      email: result.user.email,
      accountStatus: result.user.accountStatus,
      id: result.user._id,
    },
  });
});

export const zohoSocialProofWebhook = asyncHandler(async (req: Request, res: Response) => {
  assertZohoWebhookSecret(req);

  const data = normalizeZohoPayload(req.body);
  const result = await upsertFromZohoSocialProofWebhook(data);

  res.json({
    success: true,
    message: result.created ? 'Social proof submitted for review' : 'Social proof updated for review',
    data: {
      email: result.email,
      platform: result.platform,
      teamId: result.teamId,
      proofId: result.proofId,
      status: 'pending',
    },
  });
});
