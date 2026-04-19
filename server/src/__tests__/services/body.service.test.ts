/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

import * as bodyService from '../../services/body.service';

const USER_A = 'user-a';

// ─── logWeight ────────────────────────────────────────────────────────────────

describe('bodyService.logWeight', () => {
  it('upserts a BodyLog entry and returns it', async () => {
    const expected = {
      id: 'log-1',
      userId: USER_A,
      weightKg: 82.5,
      bodyFatPct: null,
      muscleMassKg: null,
      notes: null,
      photoUrl: null,
      loggedDate: new Date('2026-04-18'),
    };
    const db = {
      bodyLog: { upsert: vi.fn().mockResolvedValue(expected) },
    } as any;

    const result = await bodyService.logWeight(USER_A, { weightKg: 82.5, date: '2026-04-18' }, db);

    expect(result).toEqual(expected);
    expect(db.bodyLog.upsert).toHaveBeenCalledOnce();
  });

  it('passes bodyFatPct to the create payload when provided', async () => {
    const db = {
      bodyLog: {
        upsert: vi.fn().mockResolvedValue({ id: 'log-2', userId: USER_A, weightKg: 82.0 }),
      },
    } as any;

    await bodyService.logWeight(USER_A, { weightKg: 82.0, date: '2026-04-18', bodyFatPct: 15 }, db);

    const call = db.bodyLog.upsert.mock.calls[0][0] as { create: { bodyFatPct: number } };
    expect(call.create.bodyFatPct).toBe(15);
  });
});

// ─── getWeightHistory ─────────────────────────────────────────────────────────

describe('bodyService.getWeightHistory', () => {
  it('returns logs in date range ordered by date asc', async () => {
    const mockLogs = [
      { id: 'l-1', userId: USER_A, weightKg: 82.5, loggedDate: new Date('2026-04-15') },
      { id: 'l-2', userId: USER_A, weightKg: 82.1, loggedDate: new Date('2026-04-17') },
    ];
    const db = {
      bodyLog: { findMany: vi.fn().mockResolvedValue(mockLogs) },
    } as any;

    const result = await bodyService.getWeightHistory(
      USER_A,
      { startDate: '2026-04-15', endDate: '2026-04-17' },
      db,
    );

    expect(result).toEqual(mockLogs);
    expect(db.bodyLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_A }),
        orderBy: { loggedDate: 'asc' },
      }),
    );
  });

  it('returns empty array when no logs exist', async () => {
    const db = { bodyLog: { findMany: vi.fn().mockResolvedValue([]) } } as any;
    const result = await bodyService.getWeightHistory(
      USER_A,
      { startDate: '2026-04-01', endDate: '2026-04-30' },
      db,
    );
    expect(result).toEqual([]);
  });
});
