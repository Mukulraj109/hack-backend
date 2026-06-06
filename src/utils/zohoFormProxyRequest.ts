import express, { Request } from 'express';

const ZOHO_PROXY_PATH_RE =
  /^\/api\/hackathon\/(?:social-share|registration|follow|hiring-partner|info-session)-form\/p\//;

const ZOHO_FALLBACK_PATH_RE = /^\/FirstStep\/form\//;

export function isZohoProxyMutation(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return false;
  const path = req.path;
  return ZOHO_PROXY_PATH_RE.test(path) || ZOHO_FALLBACK_PATH_RE.test(path);
}

/** Preserve multipart / urlencoded POST bodies for Zoho form submissions (must run before express.json). */
export const zohoFormProxyRawBody = express.raw({
  type: (req) => isZohoProxyMutation(req as Request),
  limit: '25mb',
});

export interface ZohoUpstreamRequestOptions {
  zohoHost?: string;
  /** Proxied path suffix, e.g. /FirstStep/form/.../records */
  suffixPath?: string;
}

function buildZohoFormReferer(zohoHost: string, suffixPath: string): string {
  const formPath = suffixPath.replace(/\/records\/?$/, '');
  const normalized = formPath.startsWith('/') ? formPath : `/${formPath}`;
  return `https://${zohoHost}${normalized}`;
}

export function buildZohoUpstreamRequestInit(
  req: Request,
  options?: ZohoUpstreamRequestOptions
): RequestInit {
  const zohoHost = options?.zohoHost;
  const suffixPath = options?.suffixPath;
  const headers: Record<string, string> = {
    Accept: req.headers.accept || '*/*',
    'User-Agent': req.headers['user-agent'] || 'FirstStepHackathon/1.0',
    'Accept-Language': (req.headers['accept-language'] as string) || 'en-US,en;q=0.9',
  };

  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string' && contentType.trim()) {
    headers['Content-Type'] = contentType;
  }

  if (zohoHost && req.method !== 'GET' && req.method !== 'HEAD') {
    headers.Origin = `https://${zohoHost}`;
    if (suffixPath?.includes('/FirstStep/form/')) {
      headers.Referer = buildZohoFormReferer(zohoHost, suffixPath);
    } else if (typeof req.headers.referer === 'string') {
      headers.Referer = req.headers.referer;
    }
  } else if (typeof req.headers.referer === 'string') {
    headers.Referer = req.headers.referer;
  }

  const cookie = req.headers.cookie;
  if (typeof cookie === 'string' && cookie.trim()) {
    headers.Cookie = cookie;
  }

  let body: Buffer | string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      body = req.body;
    } else if (
      req.body &&
      typeof req.body === 'object' &&
      !Buffer.isBuffer(req.body) &&
      Object.keys(req.body as object).length > 0
    ) {
      body = new URLSearchParams(req.body as Record<string, string>).toString();
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      }
    }
  }

  return {
    method: req.method,
    headers,
    body,
    redirect: 'follow',
  };
}
