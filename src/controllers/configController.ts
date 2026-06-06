import { Response } from 'express';
import { HACKATHON_TRACKS } from '../config/tracks.js';
import { HackathonConfig } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/express/index.js';

/** Matches seed + sprint portal schedule when DB config is absent. */
const DEFAULT_START = new Date('2026-07-08T20:00:00-04:00');
const DEFAULT_SPRINT_HOURS = 100;
const DEFAULT_END = new Date('2026-07-13T00:00:00-04:00');

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
  const config = await HackathonConfig.findOne({ isActive: true });
  const startDate = config?.startDate ?? DEFAULT_START;
  const briefUnlocked = new Date() >= startDate;

  res.json({
    success: true,
    data: HACKATHON_TRACKS,
    meta: {
      briefUnlocked,
      briefReleaseDate: startDate,
      briefReleaseTimeLabel: '8 PM EST',
    },
  });
});
