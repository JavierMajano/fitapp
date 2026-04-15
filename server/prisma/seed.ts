/**
 * Prisma seed entry-point.
 *
 * Delegates to src/seed/exercise-seed.ts so the implementation is type-checked
 * by the project's TypeScript config and is unit-testable without a database.
 */

import { PrismaClient } from '@prisma/client';

import { seedExercises, seedMuscles, seedRoutines } from '../src/seed/exercise-seed';

const db = new PrismaClient();

async function main() {
  console.warn('Seeding database…');
  await seedMuscles(db);
  await seedExercises(db);
  await seedRoutines(db);
  console.warn('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
