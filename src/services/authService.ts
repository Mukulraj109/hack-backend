import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { generateReferralCode } from '../utils/generateCode.js';
import { TokenPayload } from '../types/express/index.js';
import { getJwtSecret, getJwtRefreshSecret } from '../utils/jwtSecrets.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  teamName?: string;
  track?: 'ai-career-agent' | 'recruiter-bridge' | 'open-build';
  referralCode?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function register(input: RegisterInput): Promise<{ user: IUser; tokens: AuthTokens }> {
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('Email already registered');
  }

  const referralCode = generateReferralCode(input.name);

  const user = new User({
    email: input.email.toLowerCase(),
    passwordHash: input.password,
    name: input.name,
    referralCode,
  });

  if (input.referralCode) {
    const referrer = await User.findOne({ referralCode: input.referralCode.toUpperCase() });
    if (referrer) {
      user.referredBy = referrer._id;
    }
  }

  await user.save();

  const tokens = generateTokens({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { user, tokens };
}

export async function login(input: LoginInput): Promise<{ user: IUser; tokens: AuthTokens }> {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isValidPassword = await user.comparePassword(input.password);
  if (!isValidPassword) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const tokens = generateTokens({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { user, tokens };
}

export function generateTokens(payload: TokenPayload): AuthTokens {
  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: '15m',
  });

  const refreshToken = jwt.sign(payload, getJwtRefreshSecret(), {
    expiresIn: '7d',
  });

  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtRefreshSecret()) as TokenPayload;
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    return generateTokens(payload);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
}

export async function getUserById(userId: string): Promise<IUser | null> {
  return User.findById(userId);
}
