import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.warn('Seeding database...');

  // Phase 4 will add:
  //  - Exercise library from wger.de (~800 exercises + muscle groups)
  //  - Default routines: PPL (6-day), Upper/Lower (4-day), Full Body (3-day)
  //  - Food item cache warm-up

  console.warn('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
