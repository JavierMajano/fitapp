import 'dotenv/config';
import { env } from './env';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  enabled: !!env.SENTRY_DSN,
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 0,
});
