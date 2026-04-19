/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

import * as progressService from '../../services/progress.service';

const USER_A = 'user-a';
const EXERCISE_ID = 'ex-bench-press';

// ─── getCalorieHistory ────────────────────────────────────────────────────────

describe('progressService.getCalorieHistory', () => {
  it('returns daily calorie data with user target', async () => {
    const mockLogs = [
      { logDate: new Date('2026-04-15'), totalCalories: 2100 },
      { logDate: new Date('2026-04-16'), totalCalories: 2400 },
    ];
    const db = {
      foodLog: { findMany: vi.fn().mockResolvedValue(mockLogs) },
      user: { findUnique: vi.fn().mockResolvedValue({ calorieTarget: 2400 }) },
    } as any;

    const result = await progressService.getCalorieHistory(
      USER_A,
      { startDate: '2026-04-15', endDate: '2026-04-16' },
      db,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: '2026-04-15',
      totalCalories: 2100,
      calorieTarget: 2400,
    });
    expect(result[1]).toMatchObject({
      date: '2026-04-16',
      totalCalories: 2400,
      calorieTarget: 2400,
    });
  });

  it('returns null calorieTarget when user has not completed onboarding', async () => {
    const db = {
      foodLog: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ logDate: new Date('2026-04-15'), totalCalories: 1800 }]),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ calorieTarget: null }) },
    } as any;

    const result = await progressService.getCalorieHistory(
      USER_A,
      { startDate: '2026-04-15', endDate: '2026-04-15' },
      db,
    );

    expect(result[0]?.calorieTarget).toBeNull();
  });

  it('returns empty array when no food logs in range', async () => {
    const db = {
      foodLog: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findUnique: vi.fn().mockResolvedValue({ calorieTarget: 2400 }) },
    } as any;

    const result = await progressService.getCalorieHistory(
      USER_A,
      { startDate: '2026-04-01', endDate: '2026-04-30' },
      db,
    );
    expect(result).toEqual([]);
  });
});

// ─── getStrengthHistory ───────────────────────────────────────────────────────

describe('progressService.getStrengthHistory', () => {
  it('returns max weight per session date for an exercise', async () => {
    const session1Date = new Date('2026-04-10');
    const session2Date = new Date('2026-04-15');

    const mockSets = [
      { weightKg: 80, session: { startedAt: session1Date } },
      { weightKg: 85, session: { startedAt: session1Date } }, // same session, higher weight
      { weightKg: 90, session: { startedAt: session2Date } },
    ];
    const db = {
      sessionSet: { findMany: vi.fn().mockResolvedValue(mockSets) },
    } as any;

    const result = await progressService.getStrengthHistory(
      USER_A,
      { exerciseId: EXERCISE_ID, startDate: '2026-04-01', endDate: '2026-04-30' },
      db,
    );

    expect(result).toHaveLength(2);
    const apr10 = result.find((r) => r.date === '2026-04-10');
    const apr15 = result.find((r) => r.date === '2026-04-15');
    expect(apr10?.maxWeightKg).toBe(85);
    expect(apr15?.maxWeightKg).toBe(90);
  });

  it('returns empty array when no sets exist for the exercise', async () => {
    const db = { sessionSet: { findMany: vi.fn().mockResolvedValue([]) } } as any;

    const result = await progressService.getStrengthHistory(
      USER_A,
      { exerciseId: EXERCISE_ID, startDate: '2026-04-01', endDate: '2026-04-30' },
      db,
    );
    expect(result).toEqual([]);
  });
});
