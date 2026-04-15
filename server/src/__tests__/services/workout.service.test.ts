import { beforeEach, describe, expect, it } from 'vitest';

import * as workoutService from '../../services/workout.service';
import { clearAll, seedRoutine } from '../../services/workout.service';

const USER_A = 'user-a';
const USER_B = 'user-b';

// ─── listRoutines ─────────────────────────────────────────────────────────────

describe('workoutService.listRoutines', () => {
  beforeEach(() => clearAll());

  it('returns an empty array when there are no routines', async () => {
    const result = await workoutService.listRoutines(USER_A, {});
    expect(result).toEqual([]);
  });

  it('returns global routines (userId = null) for any caller', async () => {
    seedRoutine({ name: 'Push/Pull/Legs', userId: null });
    const result = await workoutService.listRoutines(USER_A, {});
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Push/Pull/Legs');
  });

  it('returns only owned + global routines, not other users routines', async () => {
    seedRoutine({ name: 'Global PPL', userId: null });
    seedRoutine({ name: 'My Routine', userId: USER_A });
    seedRoutine({ name: 'Their Routine', userId: USER_B });

    const result = await workoutService.listRoutines(USER_A, {});
    expect(result).toHaveLength(2);
    const names = result.map((r) => r.name);
    expect(names).toContain('Global PPL');
    expect(names).toContain('My Routine');
    expect(names).not.toContain('Their Routine');
  });
});

// ─── startSession ─────────────────────────────────────────────────────────────

describe('workoutService.startSession', () => {
  beforeEach(() => clearAll());

  it('creates a session with correct userId and null endedAt', async () => {
    const session = await workoutService.startSession(USER_A, {}, {});
    expect(session.userId).toBe(USER_A);
    expect(session.endedAt).toBeNull();
    expect(session.id).toBeTruthy();
    expect(session.startedAt).toBeInstanceOf(Date);
  });

  it('uses the routine name when routineId is provided', async () => {
    const routine = seedRoutine({ name: 'Upper Body Blast' });
    const session = await workoutService.startSession(USER_A, { routineId: routine.id }, {});
    expect(session.routineId).toBe(routine.id);
    expect(session.name).toBe('Upper Body Blast');
  });

  it('throws NOT_FOUND when routineId does not exist', async () => {
    await expect(
      workoutService.startSession(USER_A, { routineId: 'nonexistent-id' }, {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ─── logSet ───────────────────────────────────────────────────────────────────

describe('workoutService.logSet', () => {
  let sessionId: string;

  beforeEach(async () => {
    clearAll();
    const session = await workoutService.startSession(USER_A, {}, {});
    sessionId = session.id;
  });

  it('records a set and returns correct shape', async () => {
    const set = await workoutService.logSet(
      USER_A,
      { sessionId, exerciseId: 'ex-1', setNumber: 1, weightKg: 80, reps: 8 },
      {},
    );
    expect(set.sessionId).toBe(sessionId);
    expect(set.exerciseId).toBe('ex-1');
    expect(set.setNumber).toBe(1);
    expect(set.weightKg).toBe(80);
    expect(set.reps).toBe(8);
    expect(set.completed).toBe(true);
  });

  it('throws FORBIDDEN when another user tries to log a set', async () => {
    await expect(
      workoutService.logSet(USER_B, { sessionId, exerciseId: 'ex-1', setNumber: 1 }, {}),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws BAD_REQUEST when logging a set on an ended session', async () => {
    await workoutService.endSession(USER_A, { sessionId }, {});
    await expect(
      workoutService.logSet(USER_A, { sessionId, exerciseId: 'ex-1', setNumber: 2 }, {}),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ─── endSession ───────────────────────────────────────────────────────────────

describe('workoutService.endSession', () => {
  let sessionId: string;

  beforeEach(async () => {
    clearAll();
    const session = await workoutService.startSession(USER_A, {}, {});
    sessionId = session.id;
  });

  it('sets endedAt to a Date', async () => {
    const ended = await workoutService.endSession(USER_A, { sessionId }, {});
    expect(ended.endedAt).toBeInstanceOf(Date);
    expect(ended.id).toBe(sessionId);
  });

  it('throws FORBIDDEN when another user tries to end the session', async () => {
    await expect(workoutService.endSession(USER_B, { sessionId }, {})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws BAD_REQUEST when ending an already-ended session', async () => {
    await workoutService.endSession(USER_A, { sessionId }, {});
    await expect(workoutService.endSession(USER_A, { sessionId }, {})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
