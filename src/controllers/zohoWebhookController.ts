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

  const createdCount = result.proofs.filter((p) => p.created).length;
  const updatedCount = result.proofs.length - createdCount;
  const message =
    result.proofs.length === 0
      ? 'No social proofs processed'
      : createdCount && updatedCount
        ? `${createdCount} submitted, ${updatedCount} updated for review`
        : createdCount
          ? `${createdCount} social proof(s) submitted for review`
          : `${updatedCount} social proof(s) updated for review`;

  res.json({
    success: true,
    message,
    data: {
      email: result.email,
      teamId: result.teamId,
      proofs: result.proofs.map((p) => ({
        platform: p.platform,
        proofId: p.proofId,
        created: p.created,
        status: 'pending',
      })),
    },
  });
});
