/**
 * Prisma seed entry-point.
 *
 * Delegates to src/seed/exercise-seed.ts so the implementation is type-checked
 * by the project's TypeScript config and is unit-testable without a database.
 */

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { seedExercises, seedMuscles, seedRoutines } from '../src/seed/exercise-seed';

const db = new PrismaClient();

/**
 * Upsert the stable E2E dev user (dev@fitapp.test).
 * Used by dev-bypass-token in the kg/lbs Playwright smoke suites.
 * Only created in non-production environments.
 */
async function seedDevUser() {
  const DEV_EMAIL = 'dev@fitapp.test';
  const existing = await db.user.findUnique({ where: { email: DEV_EMAIL } });
  if (existing) {
    console.warn('Dev user already exists, skipping.');
    return;
  }
  const hash = await bcrypt.hash('DevPass123!', 10);
  const user = await db.user.create({
    data: {
      email: DEV_EMAIL,
      passwordHash: hash,
      name: 'Dev User',
      goalMode: 'maintenance',
      weightKg: 80,
      heightCm: 175,
      age: 30,
      sex: 'male',
      activityLevel: 'moderate',
      tdeeCalories: 2711,
      calorieTarget: 2711,
      proteinTargetG: 150,
      carbsTargetG: 300,
      fatTargetG: 90,
      goalWeightKg: 75,
    },
  });
  // Mark as onboarded via settings
  await db.userSettings.create({ data: { userId: user.id } });
  console.warn('Dev user created: ' + DEV_EMAIL);
}

async function main() {
  console.warn('Seeding database…');
  await seedMuscles(db);
  await seedExercises(db);
  await seedRoutines(db);
  await seedDevUser();
  console.warn('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
