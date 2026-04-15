/**
 * Tests for server/prisma/seed.ts
 *
 * We mock:
 *  - global fetch (wger.de HTTP calls)
 *  - @prisma/client (no real DB required)
 *
 * We test the individual exported helpers so the suite runs fast and without
 * network or database access.
 */

import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import helpers under test.  The path is relative to this test file.
import {
  deriveBodyRegion,
  deriveGroup,
  fetchAllPages,
  seedExercises,
  seedMuscles,
  stripHtml,
  type WgerExerciseInfo,
  type WgerMuscle,
} from '../../seed/exercise-seed';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal mock PrismaClient with vi.fn() for every method used. */
function makeMockDb() {
  return {
    muscle: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    exercise: {
      upsert: vi
        .fn()
        .mockImplementation(({ create }: { create: { id?: string; name: string } }) =>
          Promise.resolve({ id: `ex-${create.name}`, ...create }),
        ),
      findMany: vi.fn().mockResolvedValue([]),
    },
    exerciseMuscle: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    routine: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: `routine-${data.name}`, ...data }),
        ),
    },
    routineDay: {
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: { label: string } }) =>
          Promise.resolve({ id: `day-${data.label}`, ...data }),
        ),
    },
    routineExercise: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

// ─── stripHtml ────────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('removes simple tags', () => {
    expect(stripHtml('<p>Hello world</p>')).toBe('Hello world');
  });

  it('collapses multiple whitespace', () => {
    expect(stripHtml('<p>  foo   <b>bar</b>  </p>')).toBe('foo bar');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('No tags here')).toBe('No tags here');
  });

  it('handles self-closing tags', () => {
    expect(stripHtml('Line 1<br/>Line 2')).toBe('Line 1 Line 2');
  });

  it('strips nested tags', () => {
    expect(stripHtml('<div><ul><li>Item</li></ul></div>')).toBe('Item');
  });
});

// ─── deriveGroup ──────────────────────────────────────────────────────────────

describe('deriveGroup', () => {
  it.each([
    ['Chest press', 'chest'],
    ['Back row', 'back'],
    ['Shoulder press', 'shoulders'],
    ['Deltoid raise', 'shoulders'],
    ['Bicep curl', 'arms'],
    ['Tricep pushdown', 'arms'],
    ['Leg press', 'legs'],
    ['Quad extension', 'legs'],
    ['Hamstring curl', 'legs'],
    ['Glute bridge', 'glutes'],
    ['Hip thrust', 'glutes'],
    ['Abs crunch', 'core'],
    ['Core plank', 'core'],
    ['Abdominal crunch', 'core'],
    ['Calf raise', 'legs'],
    ['Cardio running', 'cardio'],
    ['Unknown movement', 'other'],
  ] as [string, string][])('maps "%s" → "%s"', (input, expected) => {
    expect(deriveGroup(input)).toBe(expected);
  });
});

// ─── deriveBodyRegion ─────────────────────────────────────────────────────────

describe('deriveBodyRegion', () => {
  it('classifies pectoralis as anterior', () => {
    expect(deriveBodyRegion('Pectoralis major', true)).toBe('anterior');
  });

  it('classifies biceps as anterior', () => {
    expect(deriveBodyRegion('Biceps brachii', false)).toBe('anterior');
  });

  it('classifies rectus abdominis as anterior', () => {
    expect(deriveBodyRegion('Rectus abdominis', true)).toBe('anterior');
  });

  it('classifies front muscle (is_front=true) as anterior', () => {
    expect(deriveBodyRegion('Vastus lateralis', true)).toBe('anterior');
  });

  it('classifies trapezius as posterior', () => {
    expect(deriveBodyRegion('Trapezius', false)).toBe('posterior');
  });

  it('classifies gluteus as posterior', () => {
    expect(deriveBodyRegion('Gluteus maximus', false)).toBe('posterior');
  });
});

// ─── fetchAllPages ────────────────────────────────────────────────────────────

describe('fetchAllPages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns all results from a single page', async () => {
    const page = { results: [{ id: 1 }, { id: 2 }], next: null };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page),
      }),
    );

    const results = await fetchAllPages<{ id: number }>('https://example.com/api?format=json');
    expect(results).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('follows pagination until next is null', async () => {
    const page1 = { results: [{ id: 1 }], next: 'https://example.com/api?offset=1' };
    const page2 = { results: [{ id: 2 }], next: null };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page1) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page2) }),
    );

    const results = await fetchAllPages<{ id: number }>('https://example.com/api?format=json');
    expect(results).toHaveLength(2);
    expect(results).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('throws when the server returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }));

    await expect(fetchAllPages('https://example.com/api?format=json')).rejects.toThrow(
      'wger fetch failed: 503',
    );
  });
});

// ─── seedMuscles ─────────────────────────────────────────────────────────────

describe('seedMuscles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeMuscleApiResponse(muscles: WgerMuscle[]) {
    return {
      ok: true,
      json: () => Promise.resolve({ results: muscles, next: null }),
    };
  }

  it('upserts each muscle returned by the API', async () => {
    const muscles: WgerMuscle[] = [
      { id: 1, name: 'Biceps', name_en: 'Biceps brachii', is_front: true },
      { id: 2, name: 'Triceps', name_en: 'Triceps brachii', is_front: false },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeMuscleApiResponse(muscles)));

    const db = makeMockDb();
    await seedMuscles(db as unknown as PrismaClient);

    expect(db.muscle.upsert).toHaveBeenCalledTimes(2);

    expect(db.muscle.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: 'Biceps brachii' },
        create: expect.objectContaining({ name: 'Biceps brachii', group: 'arms' }),
      }),
    );
  });

  it('falls back to name when name_en is empty', async () => {
    const muscles: WgerMuscle[] = [
      { id: 5, name: 'Pectoralis major', name_en: '', is_front: true },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeMuscleApiResponse(muscles)));

    const db = makeMockDb();
    await seedMuscles(db as unknown as PrismaClient);

    expect(db.muscle.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'Pectoralis major' } }),
    );
  });

  it('upserts nothing when the API returns an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeMuscleApiResponse([])));

    const db = makeMockDb();
    await seedMuscles(db as unknown as PrismaClient);

    expect(db.muscle.upsert).not.toHaveBeenCalled();
  });
});

// ─── seedExercises ────────────────────────────────────────────────────────────

describe('seedExercises', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeExerciseInfo(overrides: Partial<WgerExerciseInfo> = {}): WgerExerciseInfo {
    return {
      id: 1,
      uuid: 'aaaaaaaa-0000-0000-0000-000000000001',
      category: { id: 10, name: 'Chest' },
      muscles: [],
      muscles_secondary: [],
      equipment: [{ id: 3, name: 'Barbell' }],
      translations: [
        { id: 101, language: 2, name: 'Bench Press', description: '<p>Lie flat.</p>' },
      ],
      ...overrides,
    };
  }

  it('upserts an exercise with the English translation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [makeExerciseInfo()], next: null }),
      }),
    );

    const db = makeMockDb();
    await seedExercises(db as unknown as PrismaClient);

    expect(db.exercise.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_sourceRefId: { source: 'wger', sourceRefId: '1' } },
        create: expect.objectContaining({
          name: 'Bench Press',
          category: 'chest',
          equipment: 'Barbell',
          instructions: 'Lie flat.',
          source: 'wger',
          sourceRefId: '1',
        }),
      }),
    );
  });

  it('strips HTML from exercise instructions', async () => {
    const info = makeExerciseInfo({
      translations: [
        {
          id: 102,
          language: 2,
          name: 'Squat',
          description: '<ol><li>Stand</li><li>Squat down</li></ol>',
        },
      ],
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [info], next: null }),
      }),
    );

    const db = makeMockDb();
    await seedExercises(db as unknown as PrismaClient);

    const call = db.exercise.upsert.mock.calls[0][0] as { create: { instructions: string } };
    expect(call.create.instructions).not.toContain('<');
    expect(call.create.instructions).toContain('Stand');
  });

  it('upserts primary muscle relationships', async () => {
    const muscle: WgerMuscle = {
      id: 1,
      name: 'Pectoralis major',
      name_en: 'Pectoralis major',
      is_front: true,
    };
    const info = makeExerciseInfo({ muscles: [muscle] });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [info], next: null }),
      }),
    );

    const db = makeMockDb();
    // Pretend the muscle already exists in DB
    db.muscle.findMany.mockResolvedValue([{ id: 'muscle-uuid-1', name: 'Pectoralis major' }]);

    await seedExercises(db as unknown as PrismaClient);

    expect(db.exerciseMuscle.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: 'primary' }),
      }),
    );
  });

  it('upserts secondary muscle relationships with role "secondary"', async () => {
    const muscle: WgerMuscle = { id: 7, name: 'Deltoid', name_en: 'Deltoid', is_front: true };
    const info = makeExerciseInfo({ muscles: [], muscles_secondary: [muscle] });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [info], next: null }),
      }),
    );

    const db = makeMockDb();
    db.muscle.findMany.mockResolvedValue([{ id: 'muscle-uuid-7', name: 'Deltoid' }]);

    await seedExercises(db as unknown as PrismaClient);

    expect(db.exerciseMuscle.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: 'secondary' }),
      }),
    );
  });

  it('skips exercises that have no English translation name', async () => {
    const info = makeExerciseInfo({
      translations: [{ id: 200, language: 3, name: '', description: '' }],
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [info], next: null }),
      }),
    );

    const db = makeMockDb();
    await seedExercises(db as unknown as PrismaClient);

    expect(db.exercise.upsert).not.toHaveBeenCalled();
  });

  it('handles null equipment gracefully', async () => {
    const info = makeExerciseInfo({ equipment: [] });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [info], next: null }),
      }),
    );

    const db = makeMockDb();
    await seedExercises(db as unknown as PrismaClient);

    const call = db.exercise.upsert.mock.calls[0][0] as { create: { equipment: null } };
    expect(call.create.equipment).toBeNull();
  });
});
