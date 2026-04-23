import { TRPCError } from '@trpc/server';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import type { Context } from '../context';
import { appRouter, createCallerFactory } from '../router';
import { clearAll as clearWorkout } from '../services/workout.service';

// JWT_SECRET is provided by vitest.config.ts env

// Base user shape returned by db.user.findUnique / create / update mocks
const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'user@example.com',
  name: 'Test User',
  avatarUrl: null,
  goalMode: null as string | null,
  weightKg: null as number | null,
  tdeeCalories: null as number | null,
  calorieTarget: null as number | null,
  proteinTargetG: null as number | null,
  carbsTargetG: null as number | null,
  fatTargetG: null as number | null,
  goalWeightKg: null as number | null,
  goalTargetDate: null as Date | null,
  passwordHash: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  clearWorkout();
});

// ─── Mock context ─────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<Context> = {}): Context {
  return {
    db: {
      routine: { findMany: vi.fn().mockResolvedValue([]) },
      exercise: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Context['db'],
    redis: {} as Context['redis'],
    session: null,
    req: {} as Context['req'],
    res: {} as Context['res'],
    ...overrides,
  };
}

// Authenticated context — used for protectedProcedure tests
function makeAuthCtx(overrides: Partial<Context> = {}): Context {
  return makeCtx({
    session: { user: { id: 'user-uuid-1', email: 'user@example.com' } },
    db: {
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_USER) },
      routine: { findMany: vi.fn().mockResolvedValue([]) },
      exercise: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Context['db'],
    ...overrides,
  });
}

// Workout context — DB-backed session lifecycle mocks
function makeWorkoutCtx(overrides: { sessionEndedAt?: Date | null; exerciseFound?: boolean } = {}) {
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440001';
  const EXERCISE_ID = '660e8400-e29b-41d4-a716-446655440002';
  const session = {
    id: SESSION_ID,
    userId: 'user-uuid-1',
    routineId: null,
    routineDayId: null,
    name: 'Ad-hoc session',
    notes: null,
    perceivedEffort: null,
    caloriesBurned: null,
    startedAt: new Date(),
    endedAt: overrides.sessionEndedAt ?? null,
  };
  const mockRoutine = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Routine',
    userId: null,
    description: null,
    daysPerWeek: 3,
    isActive: true,
    createdAt: new Date(),
  };

  return makeCtx({
    session: { user: { id: 'user-uuid-1', email: 'user@example.com' } },
    db: {
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_USER) },
      routine: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(mockRoutine),
      },
      exercise: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi
          .fn()
          .mockResolvedValue(
            overrides.exerciseFound === false
              ? null
              : { id: EXERCISE_ID, name: 'Bench Press', category: 'strength' },
          ),
        create: vi
          .fn()
          .mockResolvedValue({ id: EXERCISE_ID, name: 'Custom Exercise', category: 'custom' }),
      },
      workoutSession: {
        create: vi.fn().mockResolvedValue(session),
        findUnique: vi.fn().mockResolvedValue(session),
        update: vi.fn().mockResolvedValue({ ...session, endedAt: new Date() }),
      },
      sessionSet: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'set-uuid-1',
            sessionId: data['sessionId'],
            exerciseId: data['exerciseId'],
            setNumber: data['setNumber'],
            setType: 'working',
            weightKg: data['weightKg'] ?? null,
            reps: data['reps'] ?? null,
            durationSeconds: null,
            distanceKm: null,
            completed: true,
            loggedAt: new Date(),
            editedAt: null,
          }),
        ),
      },
    } as unknown as Context['db'],
  });
}

const createCaller = createCallerFactory(appRouter);

// ─── health ───────────────────────────────────────────────────────────────────

describe('health', () => {
  it("returns { status: 'ok' }", async () => {
    const caller = createCaller(makeCtx());
    const result = await caller.health();
    expect(result).toEqual({ status: 'ok' });
  });
});

// ─── auth ─────────────────────────────────────────────────────────────────────

describe('auth.me', () => {
  it('throws UNAUTHORIZED when unauthenticated', async () => {
    const caller = createCaller(makeCtx());
    await expect(caller.auth.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns SafeUser when authenticated', async () => {
    const caller = createCaller(makeAuthCtx());
    const result = await caller.auth.me();
    expect(result).toMatchObject({
      id: 'user-uuid-1',
      email: 'user@example.com',
      isOnboarded: false,
    });
  });
});

describe('auth.signUp — input validation', () => {
  // Zod validation runs before the service is called, so rejection tests
  // don't need a db mock — input never reaches the service layer.
  const callerNoDb = createCaller(makeCtx());

  // signUp hits the real service; mock the db so no network call is made
  function makeSignUpCtx() {
    return makeCtx({
      db: {
        user: {
          findUnique: vi.fn().mockResolvedValue(null), // no existing user
          create: vi.fn().mockResolvedValue({
            ...MOCK_USER,
            id: 'new-uuid',
            email: 'new@example.com',
            name: 'Test User',
          }),
        },
      } as unknown as Context['db'],
    });
  }

  it('accepts valid sign-up input and returns SafeUser', async () => {
    const caller = createCaller(makeSignUpCtx());
    const result = await caller.auth.signUp({
      email: 'new@example.com',
      password: 'securepassword',
      name: 'Test User',
    });
    expect(result.user).toMatchObject({ email: 'new@example.com', isOnboarded: false });
  });

  it('rejects empty email', async () => {
    await expect(
      callerNoDb.auth.signUp({ email: '', password: 'password', name: 'Test' }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects invalid email format', async () => {
    await expect(
      callerNoDb.auth.signUp({ email: 'notanemail', password: 'password', name: 'Test' }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects password shorter than 8 characters', async () => {
    await expect(
      callerNoDb.auth.signUp({ email: 'test@test.com', password: 'short', name: 'Test' }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects empty name', async () => {
    await expect(
      callerNoDb.auth.signUp({ email: 'test@test.com', password: 'password123', name: '' }),
    ).rejects.toThrow(TRPCError);
  });
});

describe('auth.signIn — input validation', () => {
  const callerNoDb = createCaller(makeCtx());

  it('rejects missing email', async () => {
    await expect(callerNoDb.auth.signIn({ email: '', password: 'password' })).rejects.toThrow(
      TRPCError,
    );
  });

  it('rejects missing password', async () => {
    await expect(callerNoDb.auth.signIn({ email: 'test@test.com', password: '' })).rejects.toThrow(
      TRPCError,
    );
  });
});

// ─── user ─────────────────────────────────────────────────────────────────────

describe('user.completeOnboard — input validation', () => {
  const callerNoAuth = createCaller(makeCtx());

  it('throws UNAUTHORIZED when unauthenticated', async () => {
    await expect(
      callerNoAuth.user.completeOnboard({
        goalMode: 'maintenance',
        weightKg: 75,
        heightCm: 175,
        age: 25,
        sex: 'male',
        activityLevel: 'moderate',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('accepts valid onboarding input and returns SafeUser', async () => {
    const caller = createCaller(
      makeAuthCtx({
        db: {
          user: {
            findUnique: vi.fn().mockResolvedValue(MOCK_USER),
            update: vi.fn().mockResolvedValue({
              ...MOCK_USER,
              goalMode: 'maintenance',
              weightKg: 75,
              tdeeCalories: 2500,
              calorieTarget: 2500,
              proteinTargetG: 188,
              carbsTargetG: 281,
              fatTargetG: 83,
            }),
          },
          goalHistory: { create: vi.fn().mockResolvedValue({}) },
        } as unknown as Context['db'],
      }),
    );

    const result = await caller.user.completeOnboard({
      goalMode: 'maintenance',
      weightKg: 75,
      heightCm: 175,
      age: 25,
      sex: 'male',
      activityLevel: 'moderate',
    });

    expect(result).toMatchObject({ goalMode: 'maintenance', isOnboarded: true });
  });

  it('rejects invalid goalMode', async () => {
    const callerAuth = createCaller(makeAuthCtx());
    await expect(
      callerAuth.user.completeOnboard({
        goalMode: 'super-bulk' as never,
        weightKg: 75,
        heightCm: 175,
        age: 25,
        sex: 'male',
        activityLevel: 'moderate',
      }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects negative weight', async () => {
    const callerAuth = createCaller(makeAuthCtx());
    await expect(
      callerAuth.user.completeOnboard({
        goalMode: 'maintenance',
        weightKg: -10,
        heightCm: 175,
        age: 25,
        sex: 'male',
        activityLevel: 'moderate',
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe('user.updateProfile', () => {
  it('throws UNAUTHORIZED when unauthenticated', async () => {
    const caller = createCaller(makeCtx());
    await expect(caller.user.updateProfile({ name: 'New Name' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('returns updated SafeUser with new name', async () => {
    const caller = createCaller(
      makeAuthCtx({
        db: {
          user: {
            findUnique: vi.fn().mockResolvedValue(MOCK_USER),
            update: vi.fn().mockResolvedValue({ ...MOCK_USER, name: 'New Name' }),
          },
        } as unknown as Context['db'],
      }),
    );
    const result = await caller.user.updateProfile({ name: 'New Name' });
    expect(result).toMatchObject({ name: 'New Name' });
  });
});

// ─── food ─────────────────────────────────────────────────────────────────────

describe('food.search', () => {
  it('throws for empty query', async () => {
    const caller = createCaller(
      makeCtx({ redis: { get: vi.fn().mockResolvedValue(null) } as never }),
    );
    await expect(caller.food.search({ query: '' })).rejects.toThrow(TRPCError);
  });
});

describe('food.byBarcode', () => {
  it('returns null when barcode is not found', async () => {
    const redisMock = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
    };
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 0 }),
    } as Response);
    const caller = createCaller(makeCtx({ redis: redisMock as never }));
    const result = await caller.food.byBarcode({ barcode: '1234567890' });
    expect(result).toBeNull();
  });
});

describe('food.logEntry — input validation', () => {
  const FOOD_LOG_ID = 'log-uuid-1';
  const ENTRY_ID = 'entry-uuid-1';
  const FOOD_ITEM_ID = 'item-uuid-1';

  const validFoodItem = {
    name: 'Chicken Breast',
    brand: 'USDA',
    barcode: null,
    source: 'usda',
    sourceRefId: '123456',
    caloriesPer100g: 120,
    proteinPer100g: 22.5,
    carbsPer100g: 0,
    fatPer100g: 2.6,
  };

  const validEntry = {
    foodItem: validFoodItem,
    mealType: 'breakfast' as const,
    quantityGrams: 150,
    calories: 180,
    proteinG: 33.75,
    carbsG: 0,
    fatG: 3.9,
    date: '2026-04-18',
  };

  function makeFoodLogCtx() {
    return makeCtx({
      session: { user: { id: 'user-uuid-1', email: 'user@example.com' } },
      db: {
        foodItem: {
          upsert: vi.fn().mockResolvedValue({ id: FOOD_ITEM_ID, name: validFoodItem.name }),
        },
        foodLog: {
          upsert: vi.fn().mockResolvedValue({ id: FOOD_LOG_ID }),
          update: vi.fn().mockResolvedValue({}),
        },
        foodLogEntry: {
          create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              id: ENTRY_ID,
              foodLogId: FOOD_LOG_ID,
              foodItemId: FOOD_ITEM_ID,
              mealType: data['mealType'],
              quantityGrams: data['quantityGrams'],
              calories: data['calories'],
              proteinG: data['proteinG'],
              carbsG: data['carbsG'],
              fatG: data['fatG'],
              fiberG: 0,
              loggedAt: new Date(),
              editedAt: null,
            }),
          ),
        },
      } as unknown as Context['db'],
    });
  }

  it('accepts valid log entry and returns FoodLogEntry shape', async () => {
    const caller = createCaller(makeFoodLogCtx());
    const result = await caller.food.logEntry(validEntry);
    expect(result).toMatchObject({ id: ENTRY_ID, mealType: 'breakfast' });
  });

  it.each(['breakfast', 'lunch', 'dinner', 'snacks'] as const)(
    "accepts mealType '%s'",
    async (mealType) => {
      const caller = createCaller(makeFoodLogCtx());
      const result = await caller.food.logEntry({ ...validEntry, mealType });
      expect(result).toMatchObject({ mealType });
    },
  );

  it('rejects invalid mealType', async () => {
    const caller = createCaller(makeAuthCtx());
    await expect(
      caller.food.logEntry({ ...validEntry, mealType: 'brunch' as never }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects empty foodItem.name', async () => {
    const caller = createCaller(makeAuthCtx());
    await expect(
      caller.food.logEntry({ ...validEntry, foodItem: { ...validFoodItem, name: '' } }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects zero quantityGrams', async () => {
    const caller = createCaller(makeAuthCtx());
    await expect(caller.food.logEntry({ ...validEntry, quantityGrams: 0 })).rejects.toThrow(
      TRPCError,
    );
  });

  it('rejects negative quantityGrams', async () => {
    const caller = createCaller(makeAuthCtx());
    await expect(caller.food.logEntry({ ...validEntry, quantityGrams: -50 })).rejects.toThrow(
      TRPCError,
    );
  });
});

// ─── workout ──────────────────────────────────────────────────────────────────

describe('workout.listRoutines', () => {
  it('returns empty array when DB has no routines', async () => {
    const caller = createCaller(makeCtx());
    const result = await caller.workout.listRoutines();
    expect(result).toEqual([]);
  });

  it('returns routines from DB', async () => {
    const mockRoutine = {
      id: 'r-1',
      userId: null,
      name: 'Push/Pull/Legs',
      description: null,
      daysPerWeek: 6,
      isActive: true,
      createdAt: new Date(),
    };
    const caller = createCaller(
      makeCtx({
        db: {
          routine: { findMany: vi.fn().mockResolvedValue([mockRoutine]) },
          exercise: { findMany: vi.fn().mockResolvedValue([]) },
        } as unknown as Context['db'],
      }),
    );
    const result = await caller.workout.listRoutines();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Push/Pull/Legs');
  });
});

describe('workout.startSession — input validation', () => {
  it('accepts no routineId and returns a session with userId', async () => {
    const caller = createCaller(makeWorkoutCtx());
    const result = await caller.workout.startSession({});
    expect(result).toMatchObject({ userId: 'user-uuid-1', endedAt: null });
    expect(result.id).toBeTruthy();
  });

  it('accepts optional session name', async () => {
    const caller = createCaller(makeWorkoutCtx());
    const result = await caller.workout.startSession({ name: 'Push Day' });
    expect(result.id).toBeTruthy();
  });

  it('accepts valid routineId UUID when routine exists in DB', async () => {
    const caller = createCaller(makeWorkoutCtx());
    const result = await caller.workout.startSession({
      routineId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result).toMatchObject({ routineId: null }); // mock returns null routineId in session
    expect(result.id).toBeTruthy();
  });

  it('rejects non-UUID routineId', async () => {
    const caller = createCaller(makeWorkoutCtx());
    await expect(caller.workout.startSession({ routineId: 'not-a-uuid' })).rejects.toThrow(
      TRPCError,
    );
  });
});

describe('workout.logSet — input validation', () => {
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440001';

  it('accepts valid set and returns SessionSet shape', async () => {
    const caller = createCaller(makeWorkoutCtx());
    const result = await caller.workout.logSet({
      sessionId: SESSION_ID,
      exerciseName: 'Bench Press',
      setNumber: 1,
      weightKg: 100,
      reps: 8,
    });
    expect(result).toMatchObject({ sessionId: SESSION_ID, setNumber: 1, completed: true });
  });

  it('accepts set without optional fields (bodyweight)', async () => {
    const caller = createCaller(makeWorkoutCtx());
    const result = await caller.workout.logSet({
      sessionId: SESSION_ID,
      exerciseName: 'Pull-ups',
      setNumber: 1,
    });
    expect(result).toMatchObject({ sessionId: SESSION_ID, setNumber: 1, completed: true });
    expect(result.weightKg).toBeNull();
    expect(result.reps).toBeNull();
  });

  it('creates custom exercise when exercise is not found in DB', async () => {
    const caller = createCaller(makeWorkoutCtx({ exerciseFound: false }));
    const result = await caller.workout.logSet({
      sessionId: SESSION_ID,
      exerciseName: 'New Custom Exercise',
      setNumber: 1,
    });
    expect(result).toMatchObject({ sessionId: SESSION_ID, completed: true });
  });

  it('rejects setNumber of zero', async () => {
    const caller = createCaller(makeWorkoutCtx());
    await expect(
      caller.workout.logSet({ sessionId: SESSION_ID, exerciseName: 'Squat', setNumber: 0 }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects negative setNumber', async () => {
    const caller = createCaller(makeWorkoutCtx());
    await expect(
      caller.workout.logSet({ sessionId: SESSION_ID, exerciseName: 'Squat', setNumber: -1 }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects non-integer setNumber', async () => {
    const caller = createCaller(makeWorkoutCtx());
    await expect(
      caller.workout.logSet({ sessionId: SESSION_ID, exerciseName: 'Squat', setNumber: 1.5 }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects negative weightKg', async () => {
    const caller = createCaller(makeWorkoutCtx());
    await expect(
      caller.workout.logSet({
        sessionId: SESSION_ID,
        exerciseName: 'Squat',
        setNumber: 1,
        weightKg: -10,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it('accepts zero weightKg (bodyweight exercise)', async () => {
    const caller = createCaller(makeWorkoutCtx());
    const result = await caller.workout.logSet({
      sessionId: SESSION_ID,
      exerciseName: 'Push-ups',
      setNumber: 1,
      weightKg: 0,
    });
    expect(result).toMatchObject({ weightKg: 0 });
  });

  it('rejects non-UUID sessionId', async () => {
    const caller = createCaller(makeWorkoutCtx());
    await expect(
      caller.workout.logSet({ sessionId: 'bad-id', exerciseName: 'Squat', setNumber: 1 }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects empty exerciseName', async () => {
    const caller = createCaller(makeWorkoutCtx());
    await expect(
      caller.workout.logSet({ sessionId: SESSION_ID, exerciseName: '', setNumber: 1 }),
    ).rejects.toThrow(TRPCError);
  });
});

describe('workout.endSession — input validation', () => {
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440001';

  it('accepts valid sessionId and sets endedAt', async () => {
    const caller = createCaller(makeWorkoutCtx());
    const result = await caller.workout.endSession({ sessionId: SESSION_ID });
    expect(result.endedAt).toBeInstanceOf(Date);
    expect(result.id).toBeTruthy();
  });

  it('rejects non-UUID sessionId', async () => {
    const caller = createCaller(makeWorkoutCtx());
    await expect(caller.workout.endSession({ sessionId: 'not-a-uuid' })).rejects.toThrow(TRPCError);
  });
});
