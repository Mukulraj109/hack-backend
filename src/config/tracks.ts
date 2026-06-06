export const HACKATHON_TRACK_IDS = [
  'predictive-career-intelligence',
  'job-market-visualized',
  'smart-application-tracker',
  'deploy-at-scale',
  'secure-by-default',
] as const;

export type HackathonTrackId = (typeof HACKATHON_TRACK_IDS)[number];

export interface HackathonTrackDefinition {
  id: HackathonTrackId;
  number: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  accent: string;
  icon: string;
  briefUrl: string | null;
}

function trackBriefUrl(id: HackathonTrackId): string | null {
  const envKey = `TRACK_BRIEF_URL_${id.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envKey] ?? null;
}

export const HACKATHON_TRACKS: HackathonTrackDefinition[] = [
  {
    id: 'predictive-career-intelligence',
    number: '01',
    title: 'Predictive Career Intelligence',
    category: 'Data Science',
    description:
      'Build an ML-powered system that makes job matching smarter. Full brief coming soon.',
    tags: ['ML', 'NLP', 'Python'],
    accent: '#00c5a3',
    icon: '🧠',
    briefUrl: trackBriefUrl('predictive-career-intelligence'),
  },
  {
    id: 'job-market-visualized',
    number: '02',
    title: 'The Job Market, Visualized',
    category: 'Data Analysis & Creative Visualization',
    description:
      'Turn raw job market data into insights job seekers can actually act on. Full brief coming soon.',
    tags: ['Analytics', 'Visualization', 'Storytelling'],
    accent: '#3b82f6',
    icon: '📊',
    briefUrl: trackBriefUrl('job-market-visualized'),
  },
  {
    id: 'smart-application-tracker',
    number: '03',
    title: 'Smart Application Tracker',
    category: 'SDE',
    description:
      'Build a full-stack tool that changes how candidates manage their job search. Full brief coming soon.',
    tags: ['Full-Stack', 'APIs', 'Web'],
    accent: '#8b5cf6',
    icon: '⚡',
    briefUrl: trackBriefUrl('smart-application-tracker'),
  },
  {
    id: 'deploy-at-scale',
    number: '04',
    title: 'Deploy at Scale',
    category: 'SDE with Infrastructure',
    description:
      "Architect, deploy, and document infrastructure that's built to handle real traffic. Full brief coming soon.",
    tags: ['AWS/GCP', 'Docker', 'CI/CD'],
    accent: '#f59e0b',
    icon: '🏗️',
    briefUrl: trackBriefUrl('deploy-at-scale'),
  },
  {
    id: 'secure-by-default',
    number: '05',
    title: 'Secure by Default',
    category: 'Cybersecurity',
    description:
      "Find what's broken, fix it, and build something that catches it automatically. Full brief coming soon.",
    tags: ['AppSec', 'Pen Testing', 'Automation'],
    accent: '#ef4444',
    icon: '🔒',
    briefUrl: trackBriefUrl('secure-by-default'),
  },
];

export const DEFAULT_HACKATHON_TRACK_ID: HackathonTrackId = HACKATHON_TRACK_IDS[0];
