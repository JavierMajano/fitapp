import crypto from 'crypto';

import { TRPCError } from '@trpc/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Routine = {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  daysPerWeek: number;
  isActive: boolean;
  createdAt: Date;
};

export type WorkoutSession = {
  id: string;
  userId: string;
  routineId: string | null;
  name: string;
  startedAt: Date;
  endedAt: Date | null;
};

export type SessionSet = {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  loggedAt: Date;
};

// ─── In-memory stores ─────────────────────────────────────────────────────────

export const routines = new Map<string, Routine>();
export const sessions = new Map<string, WorkoutSession>();
export const sets = new Map<string, SessionSet>();

function newId(): string {
  return crypto.randomUUID();
}

/** Reset all in-memory state between test runs. */
export function clearAll(): void {
  routines.clear();
  sessions.clear();
  sets.clear();
}

// ─── Seed helpers (for tests) ─────────────────────────────────────────────────

/** Insert a routine directly into the store. Returns the created routine. */
export function seedRoutine(partial: Partial<Routine> & { name: string }): Routine {
  const id = partial.id ?? newId();
  const routine: Routine = {
    id,
    userId: partial.userId ?? null,
    name: partial.name,
    description: partial.description ?? null,
    daysPerWeek: partial.daysPerWeek ?? 3,
    isActive: partial.isActive ?? true,
    createdAt: partial.createdAt ?? new Date(),
  };
  routines.set(id, routine);
  return routine;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Return all active routines visible to the caller:
 * global routines (userId = null) plus those owned by the user (if authenticated).
 */
export async function listRoutines(userId: string | null, _db: unknown): Promise<Routine[]> {
  const all = [...routines.values()];
  return all.filter((r) => r.isActive && (r.userId === null || r.userId === userId));
}

/**
 * Create a new WorkoutSession for the user, optionally tied to a routine.
 * Throws NOT_FOUND if a routineId is provided but not found.
 */
export async function startSession(
  userId: string,
  input: { routineId?: string },
  _db: unknown,
): Promise<WorkoutSession> {
  let routine: Routine | undefined;

  if (input.routineId) {
    routine = routines.get(input.routineId);
    if (!routine) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Routine not found.' });
    }
  }

  const id = newId();
  const session: WorkoutSession = {
    id,
    userId,
    routineId: input.routineId ?? null,
    name: routine ? routine.name : 'Ad-hoc session',
    startedAt: new Date(),
    endedAt: null,
  };
  sessions.set(id, session);
  return session;
}

/**
 * Log a set against an open session.
 * Throws NOT_FOUND if the session doesn't exist.
 * Throws FORBIDDEN if the session belongs to a different user.
 * Throws BAD_REQUEST if the session is already ended.
 */
export async function logSet(
  userId: string,
  input: {
    sessionId: string;
    exerciseId: string;
    setNumber: number;
    weightKg?: number;
    reps?: number;
  },
  _db: unknown,
): Promise<SessionSet> {
  const session = sessions.get(input.sessionId);

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found.' });
  }

  if (session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your session.' });
  }

  if (session.endedAt !== null) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session already ended.' });
  }

  const id = newId();
  const set: SessionSet = {
    id,
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    setNumber: input.setNumber,
    weightKg: input.weightKg ?? null,
    reps: input.reps ?? null,
    completed: true,
    loggedAt: new Date(),
  };
  sets.set(id, set);
  return set;
}

/**
 * Mark a session as ended by setting endedAt to now.
 * Throws NOT_FOUND if the session doesn't exist.
 * Throws FORBIDDEN if the session belongs to a different user.
 * Throws BAD_REQUEST if the session is already ended.
 */
export async function endSession(
  userId: string,
  input: { sessionId: string },
  _db: unknown,
): Promise<WorkoutSession> {
  const session = sessions.get(input.sessionId);

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found.' });
  }

  if (session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your session.' });
  }

  if (session.endedAt !== null) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session already ended.' });
  }

  session.endedAt = new Date();
  return session;
}
