import { describe, expect, it, vi } from 'vitest';

import * as userService from '../../services/user.service';

const USER_ID = 'user-1';

const BASE_USER = {
  id: USER_ID,
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: null,
  goalMode: 'bulk' as string | null,
  weightKg: 80 as number | null,
  heightCm: 175 as number | null,
  age: 25 as number | null,
  sex: 'male' as string | null,
  activityLevel: 'moderate' as string | null,
  tdeeCalories: 2800 as number | null,
  calorieTarget: 3200 as number | null,
  proteinTargetG: 160 as number | null,
  carbsTargetG: 380 as number | null,
  fatTargetG: 89 as number | null,
  goalWeightKg: null as number | null,
  goalTargetDate: null as Date | null,
};

const VALID_ONBOARD = {
  goalMode: 'bulk' as const,
  weightKg: 80,
  heightCm: 175,
  age: 25,
  sex: 'male' as const,
  activityLevel: 'moderate' as const,
};

// ─── completeOnboard ──────────────────────────────────────────────────────────

describe('userService.completeOnboard', () => {
  it('returns SafeUser with isOnboarded: true and correct TDEE', async () => {
    const updatedUser = { ...BASE_USER, goalMode: 'bulk' };
    const db = {
      user: { update: vi.fn().mockResolvedValue(updatedUser) },
      goalHistory: { create: vi.fn().mockResolvedValue({}) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await userService.completeOnboard(USER_ID, VALID_ONBOARD, db);

    expect(result.isOnboarded).toBe(true);
    expect(result.goalMode).toBe('bulk');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    );
    expect(db.goalHistory.create).toHaveBeenCalledOnce();
  });

  it('stores TDEE values in db.user.update call', async () => {
    const db = {
      user: { update: vi.fn().mockResolvedValue(BASE_USER) },
      goalHistory: { create: vi.fn().mockResolvedValue({}) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await userService.completeOnboard(USER_ID, VALID_ONBOARD, db);

    const updateCall = db.user.update.mock.calls[0][0] as {
      data: { tdeeCalories: number; calorieTarget: number };
    };
    expect(updateCall.data.tdeeCalories).toBeGreaterThan(0);
    expect(updateCall.data.calorieTarget).toBe(updateCall.data.tdeeCalories + 400); // bulk
  });
});

// ─── updateProfile ────────────────────────────────────────────────────────────

describe('userService.updateProfile', () => {
  it('updates name without recalculating TDEE', async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(BASE_USER),
        update: vi.fn().mockResolvedValue({ ...BASE_USER, name: 'New Name' }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await userService.updateProfile(USER_ID, { name: 'New Name' }, db);

    expect(result.name).toBe('New Name');
    const updateCall = db.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    // TDEE fields should NOT be recalculated when only name changes
    expect(updateCall.data).not.toHaveProperty('tdeeCalories');
  });

  it('recalculates TDEE when weightKg changes', async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(BASE_USER),
        update: vi.fn().mockResolvedValue({ ...BASE_USER, weightKg: 85 }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await userService.updateProfile(USER_ID, { weightKg: 85 }, db);

    const updateCall = db.user.update.mock.calls[0][0] as { data: { tdeeCalories: number } };
    expect(updateCall.data.tdeeCalories).toBeGreaterThan(0);
  });

  it('stores goalWeightKg and goalTargetDate', async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(BASE_USER),
        update: vi.fn().mockResolvedValue({ ...BASE_USER, goalWeightKg: 75 }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await userService.updateProfile(
      USER_ID,
      { goalWeightKg: 75, goalTargetDate: '2026-12-31T00:00:00.000Z' },
      db,
    );

    const updateCall = db.user.update.mock.calls[0][0] as {
      data: { goalWeightKg: number; goalTargetDate: Date };
    };
    expect(updateCall.data.goalWeightKg).toBe(75);
    expect(updateCall.data.goalTargetDate).toBeInstanceOf(Date);
  });

  it('throws NOT_FOUND when user does not exist', async () => {
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(userService.updateProfile(USER_ID, { name: 'X' }, db)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ─── getSettings ─────────────────────────────────────────────────────────────

describe('userService.getSettings', () => {
  it('returns existing settings when found', async () => {
    const mockSettings = { id: 's-1', userId: USER_ID, unitSystem: 'imperial' };
    const db = {
      userSettings: { findUnique: vi.fn().mockResolvedValue(mockSettings) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await userService.getSettings(USER_ID, db);
    expect(result).toEqual(mockSettings);
  });

  it('creates default settings when none exist', async () => {
    const defaultSettings = { id: 's-new', userId: USER_ID, unitSystem: 'metric' };
    const db = {
      userSettings: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(defaultSettings),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await userService.getSettings(USER_ID, db);
    expect(result.unitSystem).toBe('metric');
    expect(db.userSettings.create).toHaveBeenCalledOnce();
  });
});

// ─── updateSettings ───────────────────────────────────────────────────────────

describe('userService.updateSettings', () => {
  it('upserts settings and returns updated record', async () => {
    const updated = { id: 's-1', userId: USER_ID, unitSystem: 'imperial' };
    const db = {
      userSettings: { upsert: vi.fn().mockResolvedValue(updated) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await userService.updateSettings(USER_ID, { unitSystem: 'imperial' }, db);
    expect(result.unitSystem).toBe('imperial');
    expect(db.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
  });
});
