import { Response } from 'express';
import { getEnv } from '../config/env.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
  assertHiringPartnerFormConfigured,
  buildHiringPartnerFormEmbedPath,
  createHiringPartnerFormEmbedToken,
  proxyHiringPartnerFormResource,
  serveHiringPartnerFormView,
  verifyHiringPartnerFormEmbedToken,
} from '../services/hiringPartnerFormEmbedService.js';

function hiringPartnerFormHtmlError(message: string, status = 503): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hiring partner form unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #f4f8f7; color: #3d4947; }
    .box { max-width: 28rem; margin: 4rem auto; padding: 1.5rem; border-radius: 12px; background: #fff; border: 1px solid rgba(0,104,95,.2); }
    h1 { font-size: 1.1rem; margin: 0 0 .75rem; color: #93000a; }
    p { margin: 0; line-height: 1.5; font-size: .9375rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Hiring partner form unavailable</h1>
    <p>${message.replace(/</g, '&lt;')}</p>
  </div>
</body>
</html>`;
}

export const getHiringPartnerFormAccess = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  assertHiringPartnerFormConfigured();

  const token = createHiringPartnerFormEmbedToken();
  res.json({
    success: true,
    data: {
      embedPath: buildHiringPartnerFormEmbedPath(token),
    },
  });
});

export const viewHiringPartnerForm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.query.e === 'string' ? req.query.e.trim() : '';
  if (!token) {
    res.status(400).type('html').send(hiringPartnerFormHtmlError('Missing embed session.', 400));
    return;
  }

  try {
    verifyHiringPartnerFormEmbedToken(token);
    assertHiringPartnerFormConfigured();

    const { body, contentType, status } = await serveHiringPartnerFormView(token, req);

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
        : 'Unable to load the hiring partner form. Please try again.';
    const status = err instanceof ApiError ? err.statusCode : 500;
    res.status(status).type('html').send(hiringPartnerFormHtmlError(message, status));
  }
});

export const proxyHiringPartnerFormAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.params.embedToken === 'string' ? req.params.embedToken.trim() : '';
  if (!token) {
    throw ApiError.badRequest('Missing embed session');
  }

  const suffixPath = typeof req.params[0] === 'string' ? req.params[0] : '';
  const { body, contentType, status } = await proxyHiringPartnerFormResource(token, suffixPath, req);

  res.status(status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.removeHeader('X-Frame-Options');
  res.send(body);
});
