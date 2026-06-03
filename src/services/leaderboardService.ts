import { Team, HackathonUser } from '../models/index.js';
import { calculateTeamPoints, getPointsCaps } from './pointsService.js';

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  track: string;
  points: number;
  isFinalist: boolean;
  isWinner: boolean;
  memberCount: number;
  isCurrentUser?: boolean;
  note?: string;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  currentUser?: {
    rank: number;
    teamName: string;
    points: number;
    maxPoints: number;
  };
}

export async function getLeaderboard(currentUserId?: string): Promise<LeaderboardResponse> {
  const teams = await Team.find({})
    .populate('leader', 'firstName lastName email')
    .populate('members', 'firstName lastName email');

  const caps = await getPointsCaps();

  const rankedTeams = await Promise.all(
    teams.map(async (team) => {
      const totalPoints = await calculateTeamPoints(team._id.toString());

      let note: string | undefined;
      if (totalPoints >= 200) {
        note = 'Strong demo + social proof';
      } else if (totalPoints >= 150) {
        note = 'Top recruiter pick';
      } else if (totalPoints >= 100) {
        note = 'Solid submission package';
      }

      return {
        teamId: team._id.toString(),
        teamName: team.title,
        track: team.track || 'open-build',
        points: totalPoints,
        isFinalist: team.isFinalist,
        isWinner: team.isWinner,
        memberCount: team.members.length,
        note,
      };
    })
  );

  rankedTeams.sort((a, b) => b.points - a.points);

  const leaderboard: LeaderboardEntry[] = rankedTeams.map((team, index) => ({
    ...team,
    rank: index + 1,
  }));

  let currentUserEntry: LeaderboardResponse['currentUser'] = undefined;

  if (currentUserId) {
    const hacker = await HackathonUser.findById(currentUserId);
    if (hacker) {
      const memberTeam = teams.find((t) =>
        t.members?.some((m) => {
          const memberId =
            m && typeof m === 'object' && '_id' in m
              ? (m as { _id: { toString(): string } })._id.toString()
              : String(m);
          return memberId === currentUserId;
        })
      );

      if (memberTeam) {
        const userTeam = leaderboard.find((t) => t.teamId === memberTeam._id.toString());
        if (userTeam) {
          userTeam.isCurrentUser = true;
          currentUserEntry = {
            rank: userTeam.rank,
            teamName: userTeam.teamName,
            points: userTeam.points,
            maxPoints: caps.maxPoints,
          };
        }
      }
    }
  }

  return { leaderboard, currentUser: currentUserEntry };
}

export async function getTopTeams(count: number = 10): Promise<LeaderboardEntry[]> {
  const leaderboard = await getLeaderboard();
  return leaderboard.leaderboard.slice(0, count);
}

export async function getUserRank(
  userId: string
): Promise<{ rank: number; points: number; maxPoints: number } | null> {
  const memberTeam = await Team.findOne({ members: userId }).select('_id totalPoints');
  if (!memberTeam) return null;

  const caps = await getPointsCaps();
  const points = memberTeam.totalPoints ?? 0;

  const higherRankCount = await Team.countDocuments({ totalPoints: { $gt: points } });
  const tieBreakCount = await Team.countDocuments({
    totalPoints: points,
    _id: { $lt: memberTeam._id },
  });

  return {
    rank: higherRankCount + tieBreakCount + 1,
    points,
    maxPoints: caps.maxPoints,
  };
}
