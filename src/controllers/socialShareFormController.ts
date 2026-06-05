import { Response } from 'express';
import { getEnv } from '../config/env.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
  assertSocialShareFormConfigured,
  buildSocialShareFormEmbedPath,
  createSocialShareFormEmbedToken,
  proxySocialShareFormResource,
  serveSocialShareFormView,
  verifySocialShareFormEmbedToken,
} from '../services/socialShareFormEmbedService.js';

function socialShareFormHtmlError(message: string, status = 503): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Social share form unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #f4f8f7; color: #3d4947; }
    .box { max-width: 28rem; margin: 4rem auto; padding: 1.5rem; border-radius: 12px; background: #fff; border: 1px solid rgba(0,104,95,.2); }
    h1 { font-size: 1.1rem; margin: 0 0 .75rem; color: #93000a; }
    p { margin: 0; line-height: 1.5; font-size: .9375rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Social share form unavailable</h1>
    <p>${message.replace(/</g, '&lt;')}</p>
  </div>
</body>
</html>`;
}

export const getSocialShareFormAccess = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  assertSocialShareFormConfigured();

  const token = createSocialShareFormEmbedToken();
  res.json({
    success: true,
    data: {
      embedPath: buildSocialShareFormEmbedPath(token),
    },
  });
});

export const viewSocialShareForm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.query.e === 'string' ? req.query.e.trim() : '';
  if (!token) {
    res.status(400).type('html').send(socialShareFormHtmlError('Missing embed session.', 400));
    return;
  }

  try {
    verifySocialShareFormEmbedToken(token);
    assertSocialShareFormConfigured();

    const { body, contentType, status } = await serveSocialShareFormView(token, req);

    res.status(status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.removeHeader('X-Frame-Options');
    const frameAncestors = getEnv()
      .CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .join(' ');
    res.setHeader(
      'Content-Security-Policy',
      `frame-ancestors 'self' ${frameAncestors} https://protothon2021.webflow.io https://hack-q28v.onrender.com`
    );
    res.send(body);
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.message
        : 'Unable to load the social share verification form. Please try again.';
    const status = err instanceof ApiError ? err.statusCode : 500;
    res.status(status).type('html').send(socialShareFormHtmlError(message, status));
  }
});

export const proxySocialShareFormAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.params.embedToken === 'string' ? req.params.embedToken.trim() : '';
  if (!token) {
    throw ApiError.badRequest('Missing embed session');
  }

  const suffixPath = typeof req.params[0] === 'string' ? req.params[0] : '';
  const { body, contentType, status } = await proxySocialShareFormResource(token, suffixPath, req);

  res.status(status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.removeHeader('X-Frame-Options');
  res.send(body);
});
