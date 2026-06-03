import { Response } from 'express';
import { HackathonConfig } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/express/index.js';

/** Matches seed + sprint portal schedule when DB config is absent. */
const DEFAULT_START = new Date('2026-06-10T20:00:00-04:00');
const DEFAULT_SPRINT_HOURS = 100;
const DEFAULT_END = new Date('2026-06-14T00:00:00-04:00');

function buildCountdownPayload(config: {
  startDate: Date;
  endDate: Date;
  sprintHours: number;
  maxPoints?: number;
}) {
  const now = new Date();
  const sprintEndDate = new Date(
    config.startDate.getTime() + config.sprintHours * 60 * 60 * 1000
  );
  const started = now >= config.startDate;
  const ended = now >= sprintEndDate;
  let remaining: number | null = null;
  if (!ended) {
    remaining = sprintEndDate.getTime() - now.getTime();
  }

  return {
    started,
    ended,
    startDate: config.startDate,
    endDate: config.endDate,
    sprintEndDate,
    remaining,
    sprintHours: config.sprintHours,
    maxPoints: config.maxPoints ?? 250,
  };
}

export const getConfig = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const config = await HackathonConfig.findOne({ isActive: true });

  res.json({
    success: true,
    data: config,
  });
});

export const getCountdown = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const config = await HackathonConfig.findOne({ isActive: true });

  if (!config) {
    return res.json({
      success: true,
      data: buildCountdownPayload({
        startDate: DEFAULT_START,
        endDate: DEFAULT_END,
        sprintHours: DEFAULT_SPRINT_HOURS,
      }),
    });
  }

  res.json({
    success: true,
    data: buildCountdownPayload({
      startDate: config.startDate,
      endDate: config.endDate,
      sprintHours: config.sprintHours,
      maxPoints: config.maxPoints,
    }),
  });
});

const DEFAULT_SOCIAL_HASHTAG = '#ShipIn100Hrs';

export const getSocial = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const config = await HackathonConfig.findOne({ isActive: true });

  res.json({
    success: true,
    data: {
      hashtag: config?.socialHashtag ?? DEFAULT_SOCIAL_HASHTAG,
    },
  });
});

export const getTracks = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const tracks = [
    {
      id: 'ai-career-agent',
      title: 'AI Career Agent',
      description: 'Build an AI workflow that helps candidates move faster from job search to recruiter conversations.',
      tags: ['AI', 'Automation', 'LLMs'],
    },
    {
      id: 'recruiter-bridge',
      title: 'Recruiter Bridge',
      description: 'Design a way to put great teams, proof of work, and hiring context in front of recruiters.',
      tags: ['UX', 'Hiring', 'Web'],
    },
    {
      id: 'open-build',
      title: 'Open Build',
      description: 'Use any stack and any tools to build a useful product that makes international hiring easier.',
      tags: ['Any Stack', 'Open'],
    },
  ];

  res.json({
    success: true,
    data: tracks,
  });
});
