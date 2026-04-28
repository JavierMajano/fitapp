import './instrument';
import { env } from './env';

import * as Sentry from '@sentry/node';
import * as trpcExpress from '@trpc/server/adapters/express';
import cors from 'cors';
import express from 'express';

import { authHandler } from './auth';
import { createContext } from './context';
import { db } from './db';
import { appRouter } from './router';

const app = express();
const PORT = env.PORT;

// Trust proxy headers — required for Auth.js to detect HTTPS behind Railway's load balancer
app.set('trust proxy', true);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

// Auth.js routes — must be mounted before tRPC
app.use('/auth/*', authHandler);

// Direct health check for Railway load balancer — includes exerciseCount for staging diagnostics
app.get('/health', async (_req, res) => {
  const exerciseCount = await db.exercise.count();
  res.json({ status: 'ok', exerciseCount });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'FitApp API',
    version: process.env.npm_package_version ?? '0.1.0',
    status: 'ok',
    endpoints: ['/health', '/auth', '/trpc'],
  });
});

// tRPC
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      if (error.code !== 'UNAUTHORIZED' && error.code !== 'FORBIDDEN') {
        Sentry.captureException(error, { extra: { path } });
      }
    },
  }),
);

// Sentry error handler must come after all routes
Sentry.setupExpressErrorHandler(app);

app.listen(PORT, '0.0.0.0', function () {
  console.warn(`[server] Running on port ${PORT}`);
  db.exercise.count().then((exerciseCount) => {
    db.routine.count().then((routineCount) => {
      if (exerciseCount === 0) {
        console.warn('[startup] WARNING: exercises table is empty — run prisma/seed.ts');
      } else {
        console.warn(`[startup] DB ready: ${exerciseCount} exercises, ${routineCount} routines`);
      }
    });
  });
});
