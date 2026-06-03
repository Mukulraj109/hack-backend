import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { getEnv } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const env = getEnv();

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // express-oauth2-jwt-bearer (InvalidTokenError, etc.) — avoid logging as 500
  const statusCode =
    err && typeof err === 'object' && 'statusCode' in err
      ? Number((err as { statusCode: unknown }).statusCode)
      : NaN;
  if (statusCode === 401 || statusCode === 403) {
    const message =
      /exp.*claim|timestamp check failed/i.test(err.message)
        ? 'Session expired. Please log in again.'
        : err.message;
    res.status(statusCode).json({ success: false, error: message });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: 'Uploaded file is too large.',
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: err.message || 'Invalid file upload.',
    });
    return;
  }

  if (/^Invalid file type/i.test(err.message) || /^Invalid image type/i.test(err.message)) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }

  if (err.message === 'Firebase is not initialized') {
    res.status(503).json({
      success: false,
      error: 'File uploads are temporarily unavailable. Storage is not configured.',
    });
    return;
  }

  if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
    res.status(409).json({
      success: false,
      error: 'Duplicate key — record already exists',
    });
    return;
  }

  console.error('Unexpected error:', err);

  res.status(500).json({
    success: false,
    error: env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
}
