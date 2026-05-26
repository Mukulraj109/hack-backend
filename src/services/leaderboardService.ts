import { Team, HackathonUser, JudgeScore } from '../models/index.js';

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

  const config = {
    maxPoints: 250,
    maxJudgePoints: 150,
    maxSprintPoints: 100,
  };

  const rankedTeams = await Promise.all(
    teams.map(async (team) => {
      let judgePoints = 0;

      if (team.submissions && team.submissions.length > 0) {
        const judgeScores = await JudgeScore.find({
          submission: { $in: team.submissions },
        });

        judgePoints = judgeScores.reduce((sum, score) => sum + (score.totalScore || 0), 0);
      }

      const taskPoints = team.totalPoints || 0;
      const totalPoints = taskPoints + judgePoints;

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
            maxPoints: config.maxPoints,
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
): Promise<{ rank: number; points: number } | null> {
  const result = await getLeaderboard(userId);
  if (!result.currentUser) return null;

  return {
    rank: result.currentUser.rank,
    points: result.currentUser.points,
  };
}
