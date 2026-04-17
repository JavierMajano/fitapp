import Redis from 'ioredis';

import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err);
});

// TTL constants in seconds
export const TTL = {
  FOOD_API_RESPONSE: 60 * 60 * 24, // 24 hours
  USER_SESSION: 60 * 60 * 24 * 30, // 30 days
  EXERCISE_LIBRARY: 60 * 60 * 24 * 7, // 7 days
} as const;
