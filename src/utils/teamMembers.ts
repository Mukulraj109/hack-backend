import { ITeam } from '../models/Team.js';
import { IHackathonUser } from '../models/HackathonUser.js';
import mongoose from 'mongoose';

export const TEAM_MEMBER_FIELDS =
  'firstName lastName email linkedinUrl githubUrl universityName currentCompanyName headshotUrl';

export interface TeamMemberDto {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  linkedinUrl?: string;
  githubUrl?: string;
  universityName?: string;
  currentCompanyName?: string;
  headshotUrl?: string;
  isLeader: boolean;
  isCurrentUser: boolean;
}

type PopulatedUser = Pick<
  IHackathonUser,
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'linkedinUrl'
  | 'githubUrl'
  | 'universityName'
  | 'currentCompanyName'
  | 'headshotUrl'
> & { _id: mongoose.Types.ObjectId };

function resolveLeaderId(team: ITeam): string {
  const leader = team.leader as mongoose.Types.ObjectId | PopulatedUser | string;
  if (typeof leader === 'string') {
    return leader;
  }
  if (leader && typeof leader === 'object' && '_id' in leader) {
    return leader._id.toString();
  }
  return String(leader);
}

export function formatTeamMembers(
  team: ITeam,
  currentUserId: string
): TeamMemberDto[] {
  const leaderId = resolveLeaderId(team);
  const members = team.members as Array<mongoose.Types.ObjectId | PopulatedUser>;

  return members.map((member) => {
    const populated = member as PopulatedUser;
    const id =
      populated && typeof populated === 'object' && '_id' in populated
        ? populated._id.toString()
        : member.toString();

    return {
      id,
      firstName: populated.firstName,
      lastName: populated.lastName,
      email: populated.email ?? '',
      linkedinUrl: populated.linkedinUrl,
      githubUrl: populated.githubUrl,
      universityName: populated.universityName,
      currentCompanyName: populated.currentCompanyName,
      headshotUrl: populated.headshotUrl,
      isLeader: id === leaderId,
      isCurrentUser: id === currentUserId,
    };
  });
}
