import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { getJwtSecret } from '../utils/jwtSecrets.js';

const ZOHO_HOST = 'forms.zohopublic.in';
const EMBED_PURPOSE = 'hackathon-info-session-form';
const EMBED_TTL_SECONDS = 30 * 60;

export interface InfoSessionFormEmbedClaims {
  sub: string;
  purpose: typeof EMBED_PURPOSE;
}

export function assertInfoSessionFormConfigured(): void {
  getInfoSessionFormUrl();
}

function getInfoSessionFormUrl(): string {
  const url = getEnv().ZOHO_INFO_SESSION_FORM_URL?.trim();
  if (!url) {
    throw new ApiError(
      503,
      'Information session form is not configured. Set ZOHO_INFO_SESSION_FORM_URL on the backend and restart the server.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw ApiError.internal('Information session form URL is invalid');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== ZOHO_HOST) {
    throw ApiError.internal('Information session form URL is not allowed');
  }

  return url;
}

export function createInfoSessionFormEmbedToken(): string {
  const payload: InfoSessionFormEmbedClaims = {
    sub: 'public',
    purpose: EMBED_PURPOSE,
  };

  return jwt.sign(payload, getJwtSecret(), { expiresIn: EMBED_TTL_SECONDS });
}

export function verifyInfoSessionFormEmbedToken(token: string): InfoSessionFormEmbedClaims {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as InfoSessionFormEmbedClaims;
    if (payload.purpose !== EMBED_PURPOSE || !payload.sub) {
      throw ApiError.unauthorized('Invalid information session form session');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('Information session form session expired. Refresh the page.');
  }
}

function proxyBasePath(token: string): string {
  return `/api/hackathon/info-session-form/p/${encodeURIComponent(token)}`;
}

export function buildInfoSessionFormEmbedPath(token: string): string {
  return `/api/hackathon/info-session-form/view?e=${encodeURIComponent(token)}`;
}

const EMBED_FORM_WIDTH_OVERRIDE = 'min(1020px, 100%)';

const EMBED_FORM_STYLE = `<style id="firststep-info-session-embed">
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

const EMBED_FORM_SUBMIT_SCRIPT = `<script id="firststep-info-session-embed-notify">
(function () {
  var notified = false;
  function isThankYou() {
    return !!(
      document.querySelector('.tyTemplateWidth') ||
      document.querySelector('.thankyouMsgText') ||
      document.querySelector('.thankyouText') ||
      document.querySelector('[elname="thankyou"]')
    );
  }
  function notifyParent() {
    if (notified || !isThankYou()) return;
    notified = true;
    try {
      window.parent.postMessage({ type: 'firststep-hackathon-info-session-submitted' }, '*');
    } catch (e) {}
  }
  function init() {
    notifyParent();
    if (!document.body) return;
    new MutationObserver(function () { notifyParent(); }).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`;

function injectEmbedFormStyles(html: string): string {
  let output = html.replace(
    /--form-width:\s*[^;]+;/gi,
    `--form-width: ${EMBED_FORM_WIDTH_OVERRIDE} !important;`
  );

  if (output.includes('</head>')) {
    output = output.replace('</head>', `${EMBED_FORM_STYLE}${EMBED_FORM_SUBMIT_SCRIPT}</head>`);
  } else if (/<body[\s>]/i.test(output)) {
    output = output.replace(/<body/i, `${EMBED_FORM_STYLE}${EMBED_FORM_SUBMIT_SCRIPT}<body`);
  } else {
    output = `${EMBED_FORM_STYLE}${EMBED_FORM_SUBMIT_SCRIPT}${output}`;
  }

  return output;
}

function patchEmbedFormCss(css: string): string {
  return css.replace(/--form-width:\s*[^;]+;/gi, `--form-width: ${EMBED_FORM_WIDTH_OVERRIDE} !important;`);
}

function rewriteBody(text: string, token: string, req: Request, contentType?: string): string {
  const origin = `${req.protocol}://${req.get('host')}`;
  const proxyBase = `${origin}${proxyBasePath(token)}`;
  const zohoHttps = `https://${ZOHO_HOST}`;
  const zohoProtocolRelative = `//${ZOHO_HOST}`;

  let output = text
    .replaceAll(zohoHttps, proxyBase)
    .replaceAll(zohoProtocolRelative, proxyBase)
    .replace(/X-Frame-Options:\s*[^\r\n]+/gi, '')
    .replace(/frame-ancestors[^;]*;?/gi, '');

  if (contentType?.includes('text/html')) {
    output = injectEmbedFormStyles(output);
  } else if (contentType?.includes('text/css')) {
    output = patchEmbedFormCss(output);
  }

  return output;
}

function resolveUpstreamUrl(suffixPath: string): string {
  const formUrl = getInfoSessionFormUrl();
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

export async function proxyInfoSessionFormResource(
  token: string,
  suffixPath: string,
  req: Request
): Promise<{ body: Buffer; contentType: string; status: number }> {
  verifyInfoSessionFormEmbedToken(token);

  const upstreamUrl = resolveUpstreamUrl(suffixPath);
  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers: {
      Accept: req.headers?.accept || '*/*',
      'User-Agent': req.headers?.['user-agent'] || 'FirstStepHackathon/1.0',
      'Accept-Language': req.headers?.['accept-language'] || 'en-US,en;q=0.9',
    },
    body: req.method !== 'GET' && req.method !== 'HEAD' ? (req as Request & { body: unknown }).body : undefined,
    redirect: 'follow',
  });

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

export async function serveInfoSessionFormView(
  token: string,
  req: Request
): Promise<{ body: Buffer; contentType: string; status: number }> {
  return proxyInfoSessionFormResource(token, '', req);
}
