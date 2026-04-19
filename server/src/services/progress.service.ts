import type { PrismaClient } from '../db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalorieHistoryPoint = {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  calorieTarget: number | null;
};

export type StrengthHistoryPoint = {
  date: string; // YYYY-MM-DD
  maxWeightKg: number;
};

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Return daily calorie totals from FoodLog between startDate and endDate.
 * Also includes the user's current calorieTarget for charting a target line.
 */
export async function getCalorieHistory(
  userId: string,
  input: { startDate: string; endDate: string },
  db: PrismaClient,
): Promise<CalorieHistoryPoint[]> {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  end.setDate(end.getDate() + 1);

  const [logs, user] = await Promise.all([
    db.foodLog.findMany({
      where: { userId, logDate: { gte: start, lt: end } },
      orderBy: { logDate: 'asc' },
      select: { logDate: true, totalCalories: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { calorieTarget: true } }),
  ]);

  return logs.map((log) => ({
    date: log.logDate.toISOString().slice(0, 10),
    totalCalories: log.totalCalories,
    calorieTarget: user?.calorieTarget ?? null,
  }));
}

/**
 * Return the max weight lifted per session for a given exercise, within a date range.
 */
export async function getStrengthHistory(
  userId: string,
  input: { exerciseId: string; startDate: string; endDate: string },
  db: PrismaClient,
): Promise<StrengthHistoryPoint[]> {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  end.setDate(end.getDate() + 1);

  // Fetch all sets for the exercise within sessions belonging to the user
  const sets = await db.sessionSet.findMany({
    where: {
      exerciseId: input.exerciseId,
      session: {
        userId,
        startedAt: { gte: start, lt: end },
      },
      weightKg: { not: null },
    },
    include: { session: { select: { startedAt: true } } },
    orderBy: { session: { startedAt: 'asc' } },
  });

  // Group by session date and take max weight per day
  const byDate = new Map<string, number>();
  for (const set of sets) {
    const dateKey = set.session.startedAt.toISOString().slice(0, 10);
    const current = byDate.get(dateKey) ?? 0;
    if ((set.weightKg ?? 0) > current) {
      byDate.set(dateKey, set.weightKg ?? 0);
    }
  }

  return [...byDate.entries()].map(([date, maxWeightKg]) => ({ date, maxWeightKg }));
}
