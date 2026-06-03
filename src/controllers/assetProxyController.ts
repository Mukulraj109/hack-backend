import { Request, Response } from 'express';
import { getEnv } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

function normalizeBucketHost(bucket: string): string {
  return bucket.replace(/^gs:\/\//, '').replace(/\/$/, '');
}

/** Allow only Firebase Storage URLs for this project's bucket (headshots, social proof, etc.). */
function isAllowedStorageUrl(rawUrl: string, bucket: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const bucketHost = normalizeBucketHost(bucket);
  const bucketId = bucketHost.replace(/\.firebasestorage\.app$/i, '');

  if (parsed.hostname === 'storage.googleapis.com') {
    const path = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    return (
      path.startsWith(`${bucketHost}/`) ||
      path.startsWith(`${bucketId}.firebasestorage.app/`) ||
      path.startsWith('headshots/') ||
      path.startsWith('social-proof/')
    );
  }

  if (
    parsed.hostname === bucketHost ||
    parsed.hostname === `${bucketId}.firebasestorage.app` ||
    parsed.hostname.endsWith('.firebasestorage.app')
  ) {
    const path = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    return path.startsWith('headshots/') || path.startsWith('social-proof/');
  }

  return false;
}

export const proxyImage = asyncHandler(async (req: Request, res: Response) => {
  const env = getEnv();
  const bucket = env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new ApiError(503, 'Image proxy is not configured');
  }

  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl) {
    throw ApiError.badRequest('Missing url query parameter');
  }

  if (!isAllowedStorageUrl(rawUrl, bucket)) {
    throw ApiError.forbidden('URL is not allowed');
  }

  const upstream = await fetch(rawUrl.split('?')[0], {
    headers: { Accept: 'image/*' },
  });

  if (!upstream.ok) {
    throw ApiError.notFound('Image not found');
  }

  const contentType = upstream.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await upstream.arrayBuffer());

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(buffer);
});
