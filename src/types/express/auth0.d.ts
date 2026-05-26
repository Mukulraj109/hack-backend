import type { AuthResult } from 'express-oauth2-jwt-bearer';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthResult;
    }
  }
}

export {};
