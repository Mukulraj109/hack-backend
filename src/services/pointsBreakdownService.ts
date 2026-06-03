import { HackathonUser, SocialProof } from '../models/index.js';
import {
  REGISTRATION_POINTS,
  SOCIAL_PLATFORM_POINTS,
  getJudgePointsForTeam,
  getPointsCaps,
  syncTeamPoints,
} from './pointsService.js';

export type PointsBreakdownStatus = 'completed' | 'pending' | 'submitted' | 'locked' | 'rejected';

export interface PointsBreakdownItem {
  id: 'registration' | 'instagram' | 'linkedin' | 'judge';
  label: string;
  points: number;
  earned: number;
  completed: boolean;
  status: PointsBreakdownStatus;
}

export interface PointsBreakdownResponse {
  items: PointsBreakdownItem[];
  totalEarned: number;
  maxPoints: number;
}

const LOCKED_ITEMS: PointsBreakdownItem[] = [
  {
    id: 'registration',
    label: 'Team registration',
    points: REGISTRATION_POINTS,
    earned: 0,
    completed: false,
    status: 'locked',
  },
  {
    id: 'instagram',
    label: 'Instagram Share',
    points: SOCIAL_PLATFORM_POINTS,
    earned: 0,
    completed: false,
    status: 'locked',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn Share',
    points: SOCIAL_PLATFORM_POINTS,
    earned: 0,
    completed: false,
    status: 'locked',
  },
  {
    id: 'judge',
    label: 'Judge Evaluation',
    points: 0,
    earned: 0,
    completed: false,
    status: 'locked',
  },
];

export async function getPointsBreakdown(userId: string): Promise<PointsBreakdownResponse> {
  const caps = await getPointsCaps();
  const user = await HackathonUser.findById(userId);
  if (!user) {
    return { items: [], totalEarned: 0, maxPoints: caps.maxPoints };
  }

  if (!user.team) {
    const items = LOCKED_ITEMS.map((item) =>
      item.id === 'judge' ? { ...item, points: caps.maxJudgePoints } : item
    );
    return { items, totalEarned: 0, maxPoints: caps.maxPoints };
  }

  const teamId = user.team.toString();
  const proofs = await SocialProof.find({ team: teamId });
  const instagramProof = proofs.find((p) => p.platform === 'instagram');
  const linkedinProof = proofs.find((p) => p.platform === 'linkedin');

  const instagramEarned =
    instagramProof?.status === 'verified'
      ? instagramProof.pointsEarned || SOCIAL_PLATFORM_POINTS
      : 0;
  const linkedinEarned =
    linkedinProof?.status === 'verified'
      ? linkedinProof.pointsEarned || SOCIAL_PLATFORM_POINTS
      : 0;

  const judgeEarned = await getJudgePointsForTeam(teamId, caps.maxJudgePoints);

  const items: PointsBreakdownItem[] = [
    {
      id: 'registration',
      label: 'Team registration',
      points: REGISTRATION_POINTS,
      earned: REGISTRATION_POINTS,
      completed: true,
      status: 'completed',
    },
    {
      id: 'instagram',
      label: 'Instagram Share',
      points: SOCIAL_PLATFORM_POINTS,
      earned: instagramEarned,
      completed: instagramProof?.status === 'verified',
      status: proofStatus(instagramProof?.status),
    },
    {
      id: 'linkedin',
      label: 'LinkedIn Share',
      points: SOCIAL_PLATFORM_POINTS,
      earned: linkedinEarned,
      completed: linkedinProof?.status === 'verified',
      status: proofStatus(linkedinProof?.status),
    },
    {
      id: 'judge',
      label: 'Judge Evaluation',
      points: caps.maxJudgePoints,
      earned: judgeEarned,
      completed: judgeEarned > 0,
      status: judgeStatus(judgeEarned, caps.maxJudgePoints),
    },
  ];

  const totalEarned = await syncTeamPoints(teamId);

  return {
    items,
    totalEarned,
    maxPoints: caps.maxPoints,
  };
}

function proofStatus(status?: string): PointsBreakdownStatus {
  if (status === 'verified') return 'completed';
  if (status === 'rejected') return 'rejected';
  if (status === 'pending') return 'submitted';
  return 'pending';
}

function judgeStatus(earned: number, _max: number): PointsBreakdownStatus {
  if (earned > 0) return 'completed';
  return 'locked';
}
