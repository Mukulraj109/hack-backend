import { Response } from 'express';
import { HackathonConfig } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/express/index.js';

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
      data: {
        started: false,
        ended: false,
        startDate: null,
        endDate: null,
        sprintEndDate: null,
        remaining: null,
      },
    });
  }

  const now = new Date();
  const started = now >= config.startDate;
  const endDate = new Date(config.startDate.getTime() + config.sprintHours * 60 * 60 * 1000);
  const ended = now >= endDate;

  let remaining: number | null = null;
  if (started && !ended) {
    remaining = endDate.getTime() - now.getTime();
  }

  res.json({
    success: true,
    data: {
      started,
      ended,
      startDate: config.startDate,
      endDate: config.endDate,
      sprintEndDate: endDate,
      remaining,
      sprintHours: config.sprintHours,
      maxPoints: config.maxPoints,
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
