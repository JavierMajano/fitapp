import type { PrismaClient } from '../db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BodyLogEntry = {
  id: string;
  userId: string;
  weightKg: number;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  notes: string | null;
  photoUrl: string | null;
  loggedDate: Date;
};

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Upsert a body weight log for the given date.
 * If a log already exists for (userId, date), update it; otherwise create.
 */
export async function logWeight(
  userId: string,
  input: { weightKg: number; date: string; bodyFatPct?: number },
  db: PrismaClient,
): Promise<BodyLogEntry> {
  const loggedDate = new Date(input.date);

  return db.bodyLog.upsert({
    where: { userId_loggedDate: { userId, loggedDate } } as never,
    create: {
      userId,
      loggedDate,
      weightKg: input.weightKg,
      bodyFatPct: input.bodyFatPct ?? null,
    },
    update: {
      weightKg: input.weightKg,
      ...(input.bodyFatPct !== undefined ? { bodyFatPct: input.bodyFatPct } : {}),
    },
  });
}

/**
 * Return body log entries for a user between startDate and endDate (YYYY-MM-DD), inclusive.
 */
export async function getWeightHistory(
  userId: string,
  input: { startDate: string; endDate: string },
  db: PrismaClient,
): Promise<BodyLogEntry[]> {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  end.setDate(end.getDate() + 1); // inclusive end

  return db.bodyLog.findMany({
    where: { userId, loggedDate: { gte: start, lt: end } },
    orderBy: { loggedDate: 'asc' },
  });
}
