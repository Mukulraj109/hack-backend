import { HackathonUser, IHackathonUser } from '../models/HackathonUser.js';
import { HackathonSessionUser } from '../types/express/index.js';

export function hasRegistration(user: IHackathonUser): boolean {
  return Boolean(user.registrationCompletedAt || user.zohoSubmissionId);
}

export function canWritePortal(user: IHackathonUser): boolean {
  return user.accountStatus === 'active';
}

export function toSessionUser(user: IHackathonUser): HackathonSessionUser {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    headshotUrl: user.headshotUrl,
    linkedinUrl: user.linkedinUrl,
    resumeUrl: user.resumeUrl,
    resumeFileName: user.resumeFileName,
    hiringStatus: user.hiringStatus,
    availabilityTimeline: user.availabilityTimeline,
    accountStatus: user.accountStatus,
    hasRegistration: hasRegistration(user),
    teamId: user.team?.toString(),
    canWrite: canWritePortal(user),
    totalPoints: user.totalPoints ?? 0,
    isAdmin: user.isAdmin ?? false,
  };
}

export async function getHackathonUserById(id: string): Promise<IHackathonUser | null> {
  return HackathonUser.findById(id);
}
