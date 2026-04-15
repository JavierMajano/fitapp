/**
 * Exercise Library Seeder — Phase 4-A
 *
 * Pulls muscle groups and exercises from wger.de (public REST API, no auth
 * required) and seeds them into the local database together with three
 * opinionated default routines (PPL, Upper/Lower, Full Body).
 *
 * Every operation is idempotent: existing records are identified by their
 * wger source reference id and are skipped / updated, never duplicated.
 *
 * This module is imported by server/prisma/seed.ts and is also unit-tested
 * directly (tests live in src/__tests__/seed/).
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WgerMuscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
}

export interface WgerExerciseTranslation {
  id: number;
  language: number; // 2 = English
  name: string;
  description: string;
}

export interface WgerExerciseCategory {
  id: number;
  name: string;
}

export interface WgerExerciseEquipment {
  id: number;
  name: string;
}

export interface WgerExerciseInfo {
  id: number;
  uuid: string;
  category: WgerExerciseCategory;
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: WgerExerciseEquipment[];
  translations: WgerExerciseTranslation[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags from wger description strings.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map a wger exercise category name to a normalised group string used by the
 * app (kept intentionally broad so the UI filter list stays short).
 */
export function deriveGroup(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  if (lower.includes('chest')) return 'chest';
  if (lower.includes('back')) return 'back';
  if (lower.includes('shoulder') || lower.includes('deltoid')) return 'shoulders';
  if (lower.includes('bicep') || lower.includes('arm')) return 'arms';
  if (lower.includes('tricep')) return 'arms';
  if (lower.includes('leg') || lower.includes('quad') || lower.includes('hamstring')) return 'legs';
  if (lower.includes('glute') || lower.includes('hip')) return 'glutes';
  if (lower.includes('abs') || lower.includes('core') || lower.includes('abdominal')) return 'core';
  if (lower.includes('calves') || lower.includes('calf')) return 'legs';
  if (lower.includes('cardio')) return 'cardio';
  return 'other';
}

/**
 * Map a wger muscle to a body region.
 */
export function deriveBodyRegion(muscleName: string, isFront: boolean): string {
  const lower = muscleName.toLowerCase();
  if (
    lower.includes('pectoralis') ||
    lower.includes('bicep') ||
    lower.includes('rectus abdominis') ||
    lower.includes('oblique') ||
    lower.includes('deltoid') ||
    isFront
  ) {
    return 'anterior';
  }
  return 'posterior';
}

/**
 * Paginate through a wger list endpoint, collecting all results.
 */
export async function fetchAllPages<T>(baseUrl: string, pageSize = 100): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = `${baseUrl}&limit=${pageSize}&offset=0`;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`wger fetch failed: ${res.status} ${url}`);
    const data = (await res.json()) as { results: T[]; next: string | null };
    results.push(...data.results);
    url = data.next;
  }

  return results;
}

// ─── Seed functions ───────────────────────────────────────────────────────────

export async function seedMuscles(db: PrismaClient): Promise<void> {
  console.warn('  → Fetching muscles from wger.de…');
  const muscles = await fetchAllPages<WgerMuscle>('https://wger.de/api/v2/muscle/?format=json');

  console.warn(`  → Upserting ${muscles.length} muscles…`);

  for (const m of muscles) {
    const name = m.name_en || m.name;
    const group = deriveGroup(name);
    const bodyRegion = deriveBodyRegion(name, m.is_front);

    await db.muscle.upsert({
      where: { name },
      update: { group, bodyRegion },
      create: { name, group, bodyRegion },
    });
  }
}

export async function seedExercises(db: PrismaClient): Promise<void> {
  console.warn('  → Fetching exercise info from wger.de…');
  const infos = await fetchAllPages<WgerExerciseInfo>(
    'https://wger.de/api/v2/exerciseinfo/?format=json&language=2',
  );

  // Build a map of muscle name → DB record for quick lookup
  const muscleMap = new Map<string, { id: string }>();
  const dbMuscles = await db.muscle.findMany({ select: { id: true, name: true } });
  for (const m of dbMuscles) muscleMap.set(m.name, { id: m.id });

  let upserted = 0;
  let skipped = 0;

  for (const info of infos) {
    // Prefer English translation; fall back to first available
    const translation = info.translations.find((t) => t.language === 2) ?? info.translations[0];

    if (!translation?.name) {
      skipped++;
      continue;
    }

    const name = translation.name.trim();
    const instructions = translation.description ? stripHtml(translation.description) : null;
    const category = deriveGroup(info.category?.name ?? '');
    const equipment =
      info.equipment.length > 0 ? info.equipment.map((e) => e.name).join(', ') : null;

    const exercise = await db.exercise.upsert({
      where: { source_sourceRefId: { source: 'wger', sourceRefId: String(info.id) } },
      update: { name, category, equipment, instructions },
      create: {
        name,
        category,
        equipment,
        instructions,
        source: 'wger',
        sourceRefId: String(info.id),
      },
    });

    // Upsert primary muscles
    for (const m of info.muscles) {
      const muscleName = m.name_en || m.name;
      const muscleRecord = muscleMap.get(muscleName);
      if (!muscleRecord) continue;

      await db.exerciseMuscle.upsert({
        where: { exerciseId_muscleId: { exerciseId: exercise.id, muscleId: muscleRecord.id } },
        update: { role: 'primary' },
        create: { exerciseId: exercise.id, muscleId: muscleRecord.id, role: 'primary' },
      });
    }

    // Upsert secondary muscles
    for (const m of info.muscles_secondary) {
      const muscleName = m.name_en || m.name;
      const muscleRecord = muscleMap.get(muscleName);
      if (!muscleRecord) continue;

      await db.exerciseMuscle.upsert({
        where: { exerciseId_muscleId: { exerciseId: exercise.id, muscleId: muscleRecord.id } },
        update: { role: 'secondary' },
        create: { exerciseId: exercise.id, muscleId: muscleRecord.id, role: 'secondary' },
      });
    }

    upserted++;
  }

  console.warn(`  → Exercises: ${upserted} upserted, ${skipped} skipped (no English name)`);
}

// ─── Default routines ─────────────────────────────────────────────────────────

interface RoutineDef {
  name: string;
  description: string;
  daysPerWeek: number;
  days: { label: string; muscleGroups: string[] }[];
}

const DEFAULT_ROUTINES: RoutineDef[] = [
  {
    name: 'Push / Pull / Legs (6-day)',
    description:
      'Classic PPL split. Train chest/shoulders/triceps, back/biceps, and legs on alternating days for maximum frequency and volume.',
    daysPerWeek: 6,
    days: [
      { label: 'Push A', muscleGroups: ['chest', 'shoulders', 'arms'] },
      { label: 'Pull A', muscleGroups: ['back', 'arms'] },
      { label: 'Legs A', muscleGroups: ['legs', 'glutes'] },
      { label: 'Push B', muscleGroups: ['chest', 'shoulders', 'arms'] },
      { label: 'Pull B', muscleGroups: ['back', 'arms'] },
      { label: 'Legs B', muscleGroups: ['legs', 'glutes'] },
    ],
  },
  {
    name: 'Upper / Lower (4-day)',
    description:
      'Balanced 4-day split alternating upper-body and lower-body sessions. Great for intermediate lifters.',
    daysPerWeek: 4,
    days: [
      { label: 'Upper A', muscleGroups: ['chest', 'back', 'shoulders', 'arms'] },
      { label: 'Lower A', muscleGroups: ['legs', 'glutes'] },
      { label: 'Upper B', muscleGroups: ['chest', 'back', 'shoulders', 'arms'] },
      { label: 'Lower B', muscleGroups: ['legs', 'glutes'] },
    ],
  },
  {
    name: 'Full Body (3-day)',
    description:
      'Full-body sessions three times per week. Ideal for beginners or those with limited gym time.',
    daysPerWeek: 3,
    days: [
      { label: 'Full Body A', muscleGroups: ['chest', 'back', 'legs', 'core'] },
      { label: 'Full Body B', muscleGroups: ['shoulders', 'arms', 'legs', 'glutes'] },
      { label: 'Full Body C', muscleGroups: ['chest', 'back', 'core', 'cardio'] },
    ],
  },
];

export async function seedRoutines(db: PrismaClient): Promise<void> {
  console.warn('  → Seeding default routines…');

  // Build exercise map: category → sorted list of exercise IDs
  const exercisesByCategory = new Map<string, string[]>();
  const allExercises = await db.exercise.findMany({
    select: { id: true, category: true },
    orderBy: { name: 'asc' },
  });

  for (const ex of allExercises) {
    const existing = exercisesByCategory.get(ex.category) ?? [];
    existing.push(ex.id);
    exercisesByCategory.set(ex.category, existing);
  }

  for (const routineDef of DEFAULT_ROUTINES) {
    // Idempotency: skip if a system routine with this exact name already exists
    // (userId IS NULL means it's a system/default routine)
    const existing = await db.routine.findFirst({
      where: { name: routineDef.name, userId: null },
    });

    if (existing) {
      console.warn(`    ↳ Routine "${routineDef.name}" already exists, skipping`);
      continue;
    }

    const routine = await db.routine.create({
      data: {
        name: routineDef.name,
        description: routineDef.description,
        daysPerWeek: routineDef.daysPerWeek,
        userId: null,
        isActive: true,
      },
    });

    for (let dayIdx = 0; dayIdx < routineDef.days.length; dayIdx++) {
      const dayDef = routineDef.days[dayIdx];

      const routineDay = await db.routineDay.create({
        data: {
          routineId: routine.id,
          dayIndex: dayIdx,
          label: dayDef.label,
        },
      });

      // Add up to 2 representative exercises per muscle group for this day
      let orderIndex = 0;
      for (const group of dayDef.muscleGroups) {
        const exercises = exercisesByCategory.get(group) ?? [];
        const picks = exercises.slice(0, 2);

        for (const exerciseId of picks) {
          await db.routineExercise.create({
            data: {
              routineDayId: routineDay.id,
              exerciseId,
              orderIndex: orderIndex++,
              sets: 3,
              reps: 10,
              restSeconds: 90,
            },
          });
        }
      }
    }

    console.warn(`    ↳ Created routine "${routineDef.name}"`);
  }
}
