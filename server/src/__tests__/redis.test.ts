import { describe, it, expect } from 'vitest';

import { TTL } from '../redis';

describe('TTL constants', () => {
  it('FOOD_API_RESPONSE is 24 hours', () => {
    expect(TTL.FOOD_API_RESPONSE).toBe(60 * 60 * 24);
  });

  it('USER_SESSION is 30 days', () => {
    expect(TTL.USER_SESSION).toBe(60 * 60 * 24 * 30);
  });

  it('EXERCISE_LIBRARY is 7 days', () => {
    expect(TTL.EXERCISE_LIBRARY).toBe(60 * 60 * 24 * 7);
  });

  it('all TTL values are positive integers', () => {
    for (const [key, value] of Object.entries(TTL)) {
      expect(value, `TTL.${key}`).toBeGreaterThan(0);
      expect(Number.isInteger(value), `TTL.${key} is integer`).toBe(true);
    }
  });

  it('USER_SESSION is longer than FOOD_API_RESPONSE', () => {
    expect(TTL.USER_SESSION).toBeGreaterThan(TTL.FOOD_API_RESPONSE);
  });

  it('EXERCISE_LIBRARY is longer than FOOD_API_RESPONSE', () => {
    expect(TTL.EXERCISE_LIBRARY).toBeGreaterThan(TTL.FOOD_API_RESPONSE);
  });
});
