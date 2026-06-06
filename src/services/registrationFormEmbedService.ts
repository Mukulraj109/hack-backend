import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { getJwtSecret } from '../utils/jwtSecrets.js';
import {
  buildZohoSubmitUrlRewriteScript,
  rewriteZohoEmbedBody,
} from '../utils/zohoFormEmbedRewrite.js';
import { buildZohoUpstreamRequestInit } from '../utils/zohoFormProxyRequest.js';

const ZOHO_HOST = 'forms.firststepjob.com';
const EMBED_PURPOSE = 'hackathon-registration-form';
const EMBED_TTL_SECONDS = 30 * 60;

export interface RegistrationFormEmbedClaims {
  sub: string;
  email: string;
  purpose: typeof EMBED_PURPOSE;
}

export function assertRegistrationFormConfigured(): void {
  getRegistrationFormUrl();
}

function getRegistrationFormUrl(): string {
  const url = getEnv().ZOHO_REGISTRATION_FORM_URL?.trim();
  if (!url) {
    throw new ApiError(
      503,
      'Registration form is not configured. Set ZOHO_REGISTRATION_FORM_URL on the backend and restart the server.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw ApiError.internal('Registration form URL is invalid');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== ZOHO_HOST) {
    throw ApiError.internal('Registration form URL is not allowed');
  }

  return url;
}

export function createRegistrationFormEmbedToken(userId: string, email: string): string {
  const payload: RegistrationFormEmbedClaims = {
    sub: userId,
    email,
    purpose: EMBED_PURPOSE,
  };

  return jwt.sign(payload, getJwtSecret(), { expiresIn: EMBED_TTL_SECONDS });
}

export function verifyRegistrationFormEmbedToken(token: string): RegistrationFormEmbedClaims {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as RegistrationFormEmbedClaims;
    if (payload.purpose !== EMBED_PURPOSE || !payload.sub || !payload.email) {
      throw ApiError.unauthorized('Invalid registration form session');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('Registration form session expired. Refresh the page.');
  }
}

function proxyBasePath(token: string): string {
  return `/api/hackathon/registration-form/p/${encodeURIComponent(token)}`;
}

export function buildRegistrationFormEmbedPath(token: string): string {
  return `/api/hackathon/registration-form/view?e=${encodeURIComponent(token)}`;
}

const EMBED_FORM_WIDTH_OVERRIDE = 'min(1020px, 100%)';

const EMBED_FORM_STYLE = `<style id="firststep-registration-embed">
:root {
  --form-width: ${EMBED_FORM_WIDTH_OVERRIDE} !important;
}
.templateWidth,
.tyTemplateWidth,
#formContainer,
div[elname="formWrapper"],
.fieldContWrapper,
.centerContainer {
  max-width: ${EMBED_FORM_WIDTH_OVERRIDE} !important;
  width: ${EMBED_FORM_WIDTH_OVERRIDE} !important;
  box-sizing: border-box;
}
.fieldContainer,
.fieldContainer.zf-large,
.fieldWrapper {
  max-width: 100% !important;
}
body {
  margin: 0;
  padding: 0 10px;
  box-sizing: border-box;
}
@media (max-width: 768px) {
  :root {
    --form-width: 100% !important;
  }
  body {
    padding: 0 4px;
  }
  .templateWidth,
  .tyTemplateWidth,
  #formContainer,
  div[elname="formWrapper"],
  .fieldContWrapper,
  .centerContainer {
    max-width: 100% !important;
    width: 100% !important;
  }
}
</style>`;

function injectEmbedFormStyles(html: string, token: string): string {
  const rewriteScript = buildZohoSubmitUrlRewriteScript(proxyBasePath(token));
  let output = html.replace(
    /--form-width:\s*[^;]+;/gi,
    `--form-width: ${EMBED_FORM_WIDTH_OVERRIDE} !important;`
  );

  const injected = `${rewriteScript}${EMBED_FORM_STYLE}`;
  if (output.includes('</head>')) {
    output = output.replace('</head>', `${injected}</head>`);
  } else if (/<body[\s>]/i.test(output)) {
    output = output.replace(/<body/i, `${injected}<body`);
  } else {
    output = `${injected}${output}`;
  }

  return output;
}

function patchEmbedFormCss(css: string): string {
  return css.replace(/--form-width:\s*[^;]+;/gi, `--form-width: ${EMBED_FORM_WIDTH_OVERRIDE} !important;`);
}

function rewriteBody(text: string, token: string, req: Request, contentType?: string): string {
  const origin = `${req.protocol}://${req.get('host')}`;
  const proxyPath = proxyBasePath(token);

  return rewriteZohoEmbedBody(
    text,
    {
      proxyBase: `${origin}${proxyPath}`,
      proxyBasePath: proxyPath,
      zohoHost: ZOHO_HOST,
    },
    (output) => {
      if (contentType?.includes('text/html')) {
        return injectEmbedFormStyles(output, token);
      }
      if (contentType?.includes('text/css')) {
        return patchEmbedFormCss(output);
      }
      return output;
    }
  );
}

function resolveUpstreamUrl(suffixPath: string): string {
  const formUrl = getRegistrationFormUrl();
  const base = new URL(formUrl);

  if (!suffixPath || suffixPath === '/') {
    return formUrl;
  }

  const normalized = suffixPath.startsWith('/') ? suffixPath : `/${suffixPath}`;
  const target = new URL(normalized, base.origin);

  if (target.hostname !== ZOHO_HOST) {
    throw ApiError.forbidden('Resource path is not allowed');
  }

  return target.toString();
}

export async function proxyRegistrationFormResource(
  token: string,
  suffixPath: string,
  req: Request
): Promise<{ body: Buffer; contentType: string; status: number }> {
  verifyRegistrationFormEmbedToken(token);

  const upstreamUrl = resolveUpstreamUrl(suffixPath);
  const upstream = await fetch(
    upstreamUrl,
    buildZohoUpstreamRequestInit(req, { zohoHost: ZOHO_HOST, suffixPath })
  );

  const rawType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentType = rawType.split(';')[0]?.trim() || 'application/octet-stream';
  let body = Buffer.from(await upstream.arrayBuffer());

  if (
    contentType.includes('text/html') ||
    contentType.includes('text/css') ||
    contentType.includes('javascript') ||
    contentType.includes('json')
  ) {
    body = Buffer.from(rewriteBody(body.toString('utf8'), token, req, contentType), 'utf8');
  }

  return { body, contentType, status: upstream.status };
}

export async function serveRegistrationFormView(
  token: string,
  req: Request
): Promise<{ body: Buffer; contentType: string; status: number }> {
  return proxyRegistrationFormResource(token, '', req);
}
