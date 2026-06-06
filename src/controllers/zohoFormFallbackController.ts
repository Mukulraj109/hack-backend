import { Request, Response } from 'express';
import { getEnv } from '../config/env.js';
import { proxyFollowFormResource } from '../services/followFormEmbedService.js';
import { proxyHiringPartnerFormResource } from '../services/hiringPartnerFormEmbedService.js';
import { proxyInfoSessionFormResource } from '../services/infoSessionFormEmbedService.js';
import { proxyRegistrationFormResource } from '../services/registrationFormEmbedService.js';
import { proxySocialShareFormResource } from '../services/socialShareFormEmbedService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

type FormKind =
  | 'social-share'
  | 'registration'
  | 'follow'
  | 'hiring-partner'
  | 'info-session';

const REFERER_PATTERNS: Array<{ kind: FormKind; pattern: RegExp }> = [
  {
    kind: 'social-share',
    pattern: /\/api\/hackathon\/social-share-form\/(?:view\?e=|p\/)([^/?&#]+)/,
  },
  {
    kind: 'registration',
    pattern: /\/api\/hackathon\/registration-form\/(?:view\?e=|p\/)([^/?&#]+)/,
  },
  { kind: 'follow', pattern: /\/api\/hackathon\/follow-form\/(?:view\?e=|p\/)([^/?&#]+)/ },
  {
    kind: 'hiring-partner',
    pattern: /\/api\/hackathon\/hiring-partner-form\/(?:view\?e=|p\/)([^/?&#]+)/,
  },
  {
    kind: 'info-session',
    pattern: /\/api\/hackathon\/info-session-form\/(?:view\?e=|p\/)([^/?&#]+)/,
  },
];

function extractFromReferer(referer: string | undefined): { kind: FormKind; token: string } | null {
  if (!referer) return null;

  for (const { kind, pattern } of REFERER_PATTERNS) {
    const match = referer.match(pattern);
    if (match?.[1]) {
      return { kind, token: decodeURIComponent(match[1]) };
    }
  }

  return null;
}

function matchFormKindByPath(path: string): FormKind | null {
  const env = getEnv();
  const checks: Array<{ kind: FormKind; url?: string }> = [
    { kind: 'social-share', url: env.ZOHO_SOCIAL_SHARE_FORM_URL },
    { kind: 'registration', url: env.ZOHO_REGISTRATION_FORM_URL },
    { kind: 'follow', url: env.ZOHO_FOLLOW_FORM_URL },
    { kind: 'hiring-partner', url: env.ZOHO_HIRING_PARTNER_FORM_URL },
    { kind: 'info-session', url: env.ZOHO_INFO_SESSION_FORM_URL },
  ];

  for (const { kind, url } of checks) {
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (path === parsed.pathname || path.startsWith(`${parsed.pathname}/`)) {
        return kind;
      }
    } catch {
      // ignore invalid configured URLs
    }
  }

  return null;
}

async function proxyByKind(
  kind: FormKind,
  token: string,
  suffixPath: string,
  req: Request
): Promise<{ body: Buffer; contentType: string; status: number }> {
  switch (kind) {
    case 'social-share':
      return proxySocialShareFormResource(token, suffixPath, req);
    case 'registration':
      return proxyRegistrationFormResource(token, suffixPath, req);
    case 'follow':
      return proxyFollowFormResource(token, suffixPath, req);
    case 'hiring-partner':
      return proxyHiringPartnerFormResource(token, suffixPath, req);
    case 'info-session':
      return proxyInfoSessionFormResource(token, suffixPath, req);
    default:
      throw ApiError.notFound('Form route not found');
  }
}

/** Safety net when ZFLive posts to /FirstStep/form/... on the backend origin instead of the proxy path. */
export const proxyZohoFormFallback = asyncHandler(async (req: Request, res: Response) => {
  const suffixPath = req.path;
  if (!suffixPath.startsWith('/FirstStep/form/')) {
    throw ApiError.notFound('Form route not found');
  }

  const refererContext = extractFromReferer(req.get('referer'));
  if (refererContext) {
    const { body, contentType, status } = await proxyByKind(
      refererContext.kind,
      refererContext.token,
      suffixPath,
      req
    );

    res.status(status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.removeHeader('X-Frame-Options');
    res.send(body);
    return;
  }

  const kind = matchFormKindByPath(suffixPath);
  if (kind) {
    throw ApiError.badRequest(
      'Embed session expired or missing. Close the form and reopen it from the hackathon portal.'
    );
  }

  throw ApiError.notFound('Form route not found');
});
