import { Request } from 'express';
import { AccountStatus, IHackathonUser } from '../../models/HackathonUser.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'participant' | 'admin' | 'judge';
  };
  hackathonUser?: IHackathonUser;
  auth0?: {
    sub: string;
    email?: string;
  };
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'participant' | 'admin' | 'judge';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HackathonSessionUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  accountStatus: AccountStatus;
  hasRegistration: boolean;
  teamId?: string;
  canWrite: boolean;
}
