import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/express/index.js';
import { toSessionUser } from '../services/hackathonUserService.js';
import { getUserTeam } from '../services/teamService.js';
import { formatTeamMembers } from '../utils/teamMembers.js';

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.hackathonUser!;
  const session = toSessionUser(user);
  const userId = user._id.toString();

  const team = await getUserTeam(userId);

  res.json({
    success: true,
    data: {
      user: session,
      team: team
        ? {
            id: team._id,
            title: team.title,
            inviteCode: team.inviteCode,
            track: team.track,
            memberCount: team.members.length,
            members: formatTeamMembers(team, userId),
          }
        : null,
    },
  });
});
