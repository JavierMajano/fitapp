import 'dotenv/config';
import * as trpcExpress from '@trpc/server/adapters/express';
import cors from 'cors';
import express from 'express';

import { authHandler } from './auth';
import { createContext } from './context';
import { appRouter } from './router';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

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

// Direct health check for Railway load balancer
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// tRPC
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);
app.listen(PORT, '0.0.0.0', function () {
  console.warn(`[server] Running on port ${PORT}`);
});
