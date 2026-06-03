import { Response, NextFunction } from 'express';
import { auth } from 'express-oauth2-jwt-bearer';
import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { HackathonUser } from '../models/HackathonUser.js';
import { generateReferralCode } from '../utils/generateCode.js';

function issuerUrl(domain: string): string {
  const base = domain.startsWith('http') ? domain : `https://${domain}`;
  return base.endsWith('/') ? base : `${base}/`;
}

let jwtCheck: ReturnType<typeof auth> | null = null;
let jwtCheckKey: string | null = null;

/** Hackathon API uses the SPA ID token (aud = client id), not the Management API access token. */
function getJwtCheck() {
  const env = getEnv();
  const key = `${env.AUTH0_DOMAIN}|${env.AUTH0_CLIENT_ID}`;
  if (!jwtCheck || jwtCheckKey !== key) {
    jwtCheckKey = key;
    jwtCheck = auth({
      audience: env.AUTH0_CLIENT_ID,
      issuerBaseURL: issuerUrl(env.AUTH0_DOMAIN),
      tokenSigningAlg: 'RS256',
    });
  }
  return jwtCheck;
}

function emailFromPayload(payload: Record<string, unknown>): string | undefined {
  const direct = payload.email;
  if (typeof direct === 'string' && direct) {
    return direct.toLowerCase();
  }
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith('/email') && typeof value === 'string' && value) {
      return value.toLowerCase();
    }
  }
  return undefined;
}

function auth0TokenErrorMessage(err: unknown): string {
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as Error).message)
      : 'Invalid token';
  if (/exp.*claim|timestamp check failed/i.test(message)) {
    return 'Session expired. Please log in again.';
  }
  return message;
}

export const validateAuth0Token = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  getJwtCheck()(req, res, (err: unknown) => {
    if (err) {
      next(ApiError.unauthorized(auth0TokenErrorMessage(err)));
      return;
    }
    next();
  });
};

/** Attach hacker if Bearer token is valid; continue anonymously if missing/invalid */
export const optionalHackathonAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  getJwtCheck()(req, res, (err: unknown) => {
    if (err) {
      next();
      return;
    }
    loadHackathonUser(req, res, next).catch(next);
  });
};

export const loadHackathonUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = (req.auth?.payload ?? {}) as Record<string, unknown>;
    const sub = payload.sub as string | undefined;
    const email = emailFromPayload(payload);

    if (!sub) {
      throw ApiError.unauthorized('Invalid token: missing subject');
    }

    if (!email) {
      const existing = await HackathonUser.findOne({ auth0UserId: sub });
      if (!existing) {
        throw ApiError.unauthorized(
          'Invalid token: missing email. Log in again with profile permissions (openid profile email).'
        );
      }
    }

    req.auth0 = { sub, email };

    let user = await HackathonUser.findOne({ auth0UserId: sub });

    if (!user) {
      const byEmail = await HackathonUser.findOne({ email });
      if (byEmail) {
        byEmail.auth0UserId = sub;
        if (!byEmail.firstName && payload?.given_name) {
          byEmail.firstName = payload.given_name as string;
        }
        if (!byEmail.lastName && payload?.family_name) {
          byEmail.lastName = payload.family_name as string;
        }
        await byEmail.save();
        user = byEmail;
      }
    }

    if (!user) {
      if (!email) {
        throw ApiError.unauthorized('Invalid token: missing email');
      }
      const name = (payload.name as string) || email.split('@')[0];
      user = await HackathonUser.create({
        auth0UserId: sub,
        email,
        firstName: (payload.given_name as string) || name.split(' ')[0],
        lastName: (payload.family_name as string) || name.split(' ').slice(1).join(' '),
        accountStatus: 'pending',
        referralCode: generateReferralCode(name),
      });
    } else {
      const nameFromZoho = Boolean(user.registrationCompletedAt || user.zohoSubmissionId);
      let dirty = false;
      if (!nameFromZoho) {
        if (payload.given_name && user.firstName !== payload.given_name) {
          user.firstName = payload.given_name as string;
          dirty = true;
        }
        if (payload.family_name && user.lastName !== payload.family_name) {
          user.lastName = payload.family_name as string;
          dirty = true;
        }
      } else {
        if (!user.firstName && payload.given_name) {
          user.firstName = payload.given_name as string;
          dirty = true;
        }
        if (!user.lastName && payload.family_name) {
          user.lastName = payload.family_name as string;
          dirty = true;
        }
      }
      if (dirty) {
        await user.save();
      }
    }

    req.hackathonUser = user;
    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: 'participant',
    };

    next();
  } catch (error) {
    next(error);
  }
};

export function requireActiveAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.hackathonUser) {
    next(ApiError.unauthorized());
    return;
  }

  if (req.hackathonUser.accountStatus !== 'active') {
    next(
      ApiError.forbidden(
        'Your account is not active yet. Complete registration and wait for admin approval.'
      )
    );
    return;
  }

  next();
}

export function requireRegistration(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.hackathonUser?.registrationCompletedAt && !req.hackathonUser?.zohoSubmissionId) {
    next(ApiError.forbidden('Complete hackathon registration first'));
    return;
  }
  next();
}

export function requireHackathonAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.hackathonUser?.isAdmin) {
    next(ApiError.forbidden('Admin access required'));
    return;
  }
  next();
}

export const hackerAuth = [validateAuth0Token, loadHackathonUser] as const;
export const hackerWrite = [validateAuth0Token, loadHackathonUser, requireActiveAccount] as const;
export const hackerAdmin = [validateAuth0Token, loadHackathonUser, requireHackathonAdmin] as const;
