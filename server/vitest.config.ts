import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Stub env vars so env.ts validation passes in tests without a real server
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/fitapp_test',
      JWT_SECRET: 'test-secret-at-least-32-characters-long!!',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
