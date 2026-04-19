import crypto from 'crypto';

import { TRPCError } from '@trpc/server';

import type { PrismaClient } from '../db';

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

// ─── In-memory stores (used by legacy tests) ─────────────────────────────────

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

// ─── Legacy in-memory service functions (kept for backward-compat with tests) ──

export async function listRoutines(userId: string | null, _db: unknown): Promise<Routine[]> {
  const all = [...routines.values()];
  return all.filter((r) => r.isActive && (r.userId === null || r.userId === userId));
}

export async function startSession(
  userId: string,
  input: { name?: string; routineId?: string },
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
    name: input.name ?? (routine ? routine.name : 'Ad-hoc session'),
    startedAt: new Date(),
    endedAt: null,
  };
  sessions.set(id, session);
  return session;
}

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

// ─── DB-backed types ──────────────────────────────────────────────────────────

export type DbSessionSet = {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  setType: string;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  completed: boolean;
  loggedAt: Date;
  editedAt: Date | null;
};

export type DbWorkoutSession = {
  id: string;
  userId: string;
  routineId: string | null;
  routineDayId: string | null;
  name: string;
  notes: string | null;
  perceivedEffort: number | null;
  caloriesBurned: number | null;
  startedAt: Date;
  endedAt: Date | null;
  sets: DbSessionSet[];
};

// ─── DB-backed service functions ──────────────────────────────────────────────

/** List all active routines: global (userId=null) + those owned by user. Uses real DB. */
export async function listRoutinesDb(
  userId: string | null,
  db: PrismaClient,
): Promise<
  {
    id: string;
    userId: string | null;
    name: string;
    description: string | null;
    daysPerWeek: number;
    isActive: boolean;
    createdAt: Date;
  }[]
> {
  return db.routine.findMany({
    where: {
      isActive: true,
      OR: [{ userId: null }, ...(userId ? [{ userId }] : [])],
    },
    orderBy: { createdAt: 'asc' },
  });
}

/** List all exercises from DB (used by progress strength picker and workout log modal). */
export async function listExercises(db: PrismaClient): Promise<
  {
    id: string;
    name: string;
    category: string;
    equipment: string | null;
    movementType: string | null;
  }[]
> {
  return db.exercise.findMany({
    select: { id: true, name: true, category: true, equipment: true, movementType: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Create a new WorkoutSession in the DB.
 * If routineId is provided, the session name is taken from the routine.
 * Otherwise uses input.name or falls back to 'Ad-hoc session'.
 */
export async function startSessionDb(
  userId: string,
  input: { name?: string; routineId?: string },
  db: PrismaClient,
): Promise<Omit<DbWorkoutSession, 'sets'>> {
  let sessionName = input.name ?? 'Ad-hoc session';

  if (input.routineId) {
    const routine = await db.routine.findUnique({ where: { id: input.routineId } });
    if (!routine) throw new TRPCError({ code: 'NOT_FOUND', message: 'Routine not found.' });
    sessionName = routine.name;
  }

  return db.workoutSession.create({
    data: {
      userId,
      routineId: input.routineId ?? null,
      name: sessionName,
    },
  });
}

/**
 * Log a set against an open DB-backed session.
 * Finds the exercise by name (case-insensitive); creates a custom exercise if not found.
 */
export async function logSetDb(
  userId: string,
  input: {
    sessionId: string;
    exerciseName: string;
    setNumber: number;
    weightKg?: number;
    reps?: number;
  },
  db: PrismaClient,
): Promise<DbSessionSet> {
  // Verify session ownership
  const session = await db.workoutSession.findUnique({ where: { id: input.sessionId } });
  if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found.' });
  if (session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your session.' });
  }
  if (session.endedAt !== null) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session already ended.' });
  }

  // Find or create exercise by name
  let exercise = await db.exercise.findFirst({
    where: { name: { equals: input.exerciseName, mode: 'insensitive' } },
  });

  if (!exercise) {
    exercise = await db.exercise.create({
      data: {
        name: input.exerciseName,
        category: 'custom',
        source: 'custom',
      },
    });
  }

  return db.sessionSet.create({
    data: {
      sessionId: input.sessionId,
      exerciseId: exercise.id,
      setNumber: input.setNumber,
      weightKg: input.weightKg ?? null,
      reps: input.reps ?? null,
      completed: true,
    },
  });
}

/**
 * Mark a DB session as ended.
 * Returns the updated session (without sets).
 */
export async function endSessionDb(
  userId: string,
  input: { sessionId: string },
  db: PrismaClient,
): Promise<Omit<DbWorkoutSession, 'sets'>> {
  const session = await db.workoutSession.findUnique({ where: { id: input.sessionId } });
  if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found.' });
  if (session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your session.' });
  }
  if (session.endedAt !== null) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session already ended.' });
  }

  return db.workoutSession.update({
    where: { id: input.sessionId },
    data: { endedAt: new Date() },
  });
}

/** Get all workout sessions for a user on a given date (YYYY-MM-DD), including sets. */
export async function getSessionsByDate(
  userId: string,
  date: string,
  db: PrismaClient,
): Promise<DbWorkoutSession[]> {
  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  const dbSessions = await db.workoutSession.findMany({
    where: { userId, startedAt: { gte: start, lt: end } },
    include: { sets: { orderBy: [{ setNumber: 'asc' }] } },
    orderBy: { startedAt: 'desc' },
  });

  return dbSessions;
}

/** Update a set's weight/reps; sets editedAt. Throws FORBIDDEN for wrong user. */
export async function updateSet(
  userId: string,
  input: { setId: string; weightKg?: number; reps?: number },
  db: PrismaClient,
): Promise<DbSessionSet> {
  const set = await db.sessionSet.findUnique({
    where: { id: input.setId },
    include: { session: true },
  });

  if (!set) throw new TRPCError({ code: 'NOT_FOUND', message: 'Set not found.' });
  if (set.session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your set.' });
  }

  return db.sessionSet.update({
    where: { id: input.setId },
    data: {
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
      ...(input.reps !== undefined ? { reps: input.reps } : {}),
      editedAt: new Date(),
    },
  });
}

/** Delete a set. Throws FORBIDDEN for wrong user. */
export async function deleteSet(
  userId: string,
  setId: string,
  db: PrismaClient,
): Promise<{ success: boolean }> {
  const set = await db.sessionSet.findUnique({
    where: { id: setId },
    include: { session: true },
  });

  if (!set) throw new TRPCError({ code: 'NOT_FOUND', message: 'Set not found.' });
  if (set.session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your set.' });
  }

  await db.sessionSet.delete({ where: { id: setId } });
  return { success: true };
}
