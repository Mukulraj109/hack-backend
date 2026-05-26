import { Team, ITeam } from '../models/index.js';
import { HackathonUser } from '../models/HackathonUser.js';
import { ApiError } from '../utils/ApiError.js';
import { generateTeamInviteCode } from '../utils/generateInviteCode.js';
import { TEAM_MEMBER_FIELDS } from '../utils/teamMembers.js';

const LEADER_FIELDS = TEAM_MEMBER_FIELDS;

export interface CreateTeamInput {
  title: string;
  leaderId: string;
}

export async function createTeam(input: CreateTeamInput): Promise<ITeam> {
  const leader = await HackathonUser.findById(input.leaderId);
  if (!leader) {
    throw ApiError.notFound('User not found');
  }

  if (leader.team) {
    throw ApiError.conflict('You are already on a team');
  }

  const inviteCode = await generateTeamInviteCode();

  const team = new Team({
    title: input.title,
    leader: input.leaderId,
    members: [input.leaderId],
    inviteCode,
  });

  await team.save();

  await HackathonUser.findByIdAndUpdate(input.leaderId, {
    $set: { team: team._id },
  });

  return team;
}

export async function joinTeam(inviteCode: string, userId: string): Promise<ITeam> {
  const normalized = inviteCode.trim().toUpperCase();
  const team = await Team.findOne({
    inviteCode: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  });

  if (!team) {
    throw ApiError.notFound('Team not found with this Team ID');
  }

  const memberIds = team.members.map((m) => m.toString());
  if (memberIds.includes(userId)) {
    throw ApiError.conflict('You are already a member of this team');
  }

  if (team.members.length >= 4) {
    throw ApiError.badRequest('Team is full (max 4 members)');
  }

  const user = await HackathonUser.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  if (user.team && user.team.toString() !== team._id.toString()) {
    throw ApiError.conflict('Leave your current team before joining another');
  }

  team.members.push(userId as unknown as typeof team.members[0]);
  await team.save();

  await HackathonUser.findByIdAndUpdate(userId, {
    $set: { team: team._id },
  });

  return team;
}

export async function leaveTeam(teamId: string, userId: string): Promise<void> {
  const team = await Team.findById(teamId);
  if (!team) {
    throw ApiError.notFound('Team not found');
  }

  if (team.leader.toString() === userId) {
    throw ApiError.badRequest('Team leader cannot leave. Transfer leadership first or delete the team.');
  }

  team.members = team.members.filter((m) => m.toString() !== userId);
  await team.save();

  await HackathonUser.findByIdAndUpdate(userId, {
    $unset: { team: 1 },
  });
}

export async function removeMember(teamId: string, memberId: string, requesterId: string): Promise<void> {
  const team = await Team.findById(teamId);
  if (!team) {
    throw ApiError.notFound('Team not found');
  }

  if (team.leader.toString() !== requesterId) {
    throw ApiError.forbidden('Only team leader can remove members');
  }

  if (memberId === requesterId) {
    throw ApiError.badRequest('Cannot remove yourself');
  }

  team.members = team.members.filter((m) => m.toString() !== memberId);
  await team.save();

  await HackathonUser.findByIdAndUpdate(memberId, {
    $unset: { team: 1 },
  });
}

export async function getTeamById(teamId: string): Promise<ITeam | null> {
  return Team.findById(teamId)
    .populate('leader', LEADER_FIELDS)
    .populate('members', TEAM_MEMBER_FIELDS);
}

export async function getTeamByInviteCode(inviteCode: string): Promise<ITeam | null> {
  const normalized = inviteCode.trim();
  return Team.findOne({
    inviteCode: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  })
    .populate('leader', LEADER_FIELDS)
    .populate('members', TEAM_MEMBER_FIELDS);
}

export async function getAllTeams(): Promise<ITeam[]> {
  return Team.find({})
    .populate('leader', LEADER_FIELDS)
    .sort({ totalPoints: -1 });
}

export async function getTeamsByTrack(track: string): Promise<ITeam[]> {
  return Team.find({ track })
    .populate('leader', LEADER_FIELDS)
    .sort({ totalPoints: -1 });
}

export async function getUserTeam(userId: string): Promise<ITeam | null> {
  return Team.findOne({ members: userId })
    .populate('leader', LEADER_FIELDS)
    .populate('members', TEAM_MEMBER_FIELDS);
}

export async function updateTeam(
  teamId: string,
  updates: Partial<ITeam>,
  requesterId: string
): Promise<ITeam> {
  const team = await Team.findById(teamId);
  if (!team) {
    throw ApiError.notFound('Team not found');
  }

  if (team.leader.toString() !== requesterId) {
    throw ApiError.forbidden('Only team leader can update team');
  }

  if (updates.title) {
    team.title = updates.title;
  }
  if (updates.track) {
    team.track = updates.track;
  }

  await team.save();

  return team;
}
