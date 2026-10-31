import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { errorMiddleware, notFound } from './middleware/error.js';
import auth from './routes/auth.js';
import problems from './routes/problems.js';
import submissions from './routes/submissions.js';
import contests from './routes/contests.js';
import admin from './routes/admin.js';
import users from './routes/users.js';

import { createRedis, Calibration } from '@judgebox/shared';
import { judgeQueue } from './queues.js';

export function createApp() {
  const app = express();
  const redis = createRedis(config.redisUrl);
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '25mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date() }));
  app.get('/api/telemetry', async (_req, res) => {
    try {
      const workers = [];
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', 'jb:worker:*', 'COUNT', 100);
        cursor = next;
        if (keys.length) {
          const vals = await redis.mget(keys);
          vals.forEach((v) => v && workers.push(JSON.parse(v)));
        }
      } while (cursor !== '0');
      const [waiting, active] = await Promise.all([
        judgeQueue.getWaitingCount().catch(() => 0),
        judgeQueue.getActiveCount().catch(() => 0),
      ]);
      const recentCalib = await Calibration.find().sort({ ts: -1 }).limit(30).lean().catch(() => []);
      res.json({
        status: 'healthy',
        workers,
        queue: { waiting, active },
        calibration: recentCalib.reverse().map((c) => ({ ts: c.ts, canaryMs: c.canaryMs, speedFactor: c.speedFactor })),
      });
    } catch (err) {
      res.json({ status: 'degraded', error: err.message, workers: [] });
    }
  });

  app.use('/api/auth', auth);
  app.use('/api/problems', problems);
  app.use('/api/submissions', submissions);
  app.use('/api/contests', contests);
  app.use('/api/admin', admin);
  app.use('/api/users', users);

  app.use(notFound);
  app.use(errorMiddleware);
  return app;
}
