import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import submissionRoutes from './routes/submissions.js';
import leaderboardRoutes from './routes/leaderboard.js';
import referralRoutes from './routes/referrals.js';
import announcementRoutes from './routes/announcements.js';
import socialProofRoutes from './routes/socialProof.js';
import adminRoutes from './routes/admin.js';
import configRoutes from './routes/config.js';
import assetRoutes from './routes/assets.js';
import hackathonRoutes from './routes/hackathon.js';
import hackathonAdminRoutes from './routes/hackathonAdmin.js';
import webhookRoutes from './routes/webhooks.js';
import { proxyZohoFormFallback } from './controllers/zohoFormFallbackController.js';
import { zohoFormProxyRawBody } from './utils/zohoFormProxyRequest.js';
import { getEnv } from './config/env.js';

export function createApp(): Application {
  const app = express();
  const env = getEnv();

  const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  app.use(cors({
    origin:
      env.NODE_ENV === 'production'
        ? [...corsOrigins, 'https://hack-q28v.onrender.com', 'https://protothon2021.webflow.io']
        : corsOrigins,
    credentials: true,
  }));

  app.use(zohoFormProxyRawBody);
  app.use((req, res, next) => {
    if (Buffer.isBuffer(req.body)) return next();
    express.json()(req, res, next);
  });
  app.use((req, res, next) => {
    if (Buffer.isBuffer(req.body)) return next();
    express.urlencoded({ extended: true })(req, res, next);
  });
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/submissions', submissionRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/social-proof', socialProofRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/assets', assetRoutes);
  app.use('/api/hackathon', hackathonRoutes);
  app.use('/api/hackathon/admin', hackathonAdminRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // ZFLive may POST to /FirstStep/form/... on our origin when embedded via proxy iframe.
  app.all(/^\/FirstStep\/form\/.*$/, proxyZohoFormFallback);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
