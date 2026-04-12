import { TRPCError } from '@trpc/server';
import { describe, it, expect, vi } from 'vitest';

import type { Context } from '../context';
import { appRouter, createCallerFactory } from '../router';

// signUp and signIn both sign JWTs — provide a secret for tests
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

// ─── Mock context ─────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<Context> = {}): Context {
  return {
    db: {} as Context['db'],
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
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-uuid-1',
          email: 'user@example.com',
          name: 'Test User',
          avatarUrl: null,
          goalMode: null,
          tdeeCalories: null,
          calorieTarget: null,
          proteinTargetG: null,
          carbsTargetG: null,
          fatTargetG: null,
        }),
      },
    } as unknown as Context['db'],
    ...overrides,
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

  // signUp now hits the real service; mock the db so no network call is made
  function makeSignUpCtx() {
    return makeCtx({
      db: {
        user: {
          findUnique: vi.fn().mockResolvedValue(null), // no existing user
          create: vi.fn().mockResolvedValue({
            id: 'new-uuid',
            email: 'new@example.com',
            name: 'Test User',
            avatarUrl: null,
            goalMode: null,
            tdeeCalories: null,
            calorieTarget: null,
            proteinTargetG: null,
            carbsTargetG: null,
            fatTargetG: null,
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

  it('rejects invalid email', async () => {
    await expect(
      callerNoDb.auth.signUp({ email: 'bad', password: 'securepass', name: 'X' }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects password shorter than 8 chars', async () => {
    await expect(
      callerNoDb.auth.signUp({ email: 'a@b.com', password: 'short', name: 'X' }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects empty name', async () => {
    await expect(
      callerNoDb.auth.signUp({ email: 'a@b.com', password: 'validpassword', name: '' }),
    ).rejects.toThrow(TRPCError);
  });
});

describe('auth.signIn — input validation', () => {
  // Zod validation happens before the db is touched, so invalid input tests
  // can use an empty context. Only the valid-input test needs a db mock.
  const callerNoDb = createCaller(makeCtx());

  it('rejects malformed email', async () => {
    await expect(callerNoDb.auth.signIn({ email: 'notanemail', password: 'pass' })).rejects.toThrow(
      TRPCError,
    );
  });

  it('rejects empty password', async () => {
    await expect(callerNoDb.auth.signIn({ email: 'a@b.com', password: '' })).rejects.toThrow(
      TRPCError,
    );
  });

  it('throws UNAUTHORIZED for wrong password (real service, mocked db)', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('correct-pass', 1);
    const caller = createCaller(
      makeCtx({
        db: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              ...{
                id: 'u1',
                email: 'a@b.com',
                name: 'A',
                avatarUrl: null,
                goalMode: null,
                tdeeCalories: null,
                calorieTarget: null,
                proteinTargetG: null,
                carbsTargetG: null,
                fatTargetG: null,
              },
              passwordHash,
            }),
          },
        } as unknown as Context['db'],
      }),
    );
    await expect(
      caller.auth.signIn({ email: 'a@b.com', password: 'wrong-pass' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ─── user ─────────────────────────────────────────────────────────────────────

describe('user.updateProfile — input validation', () => {
  const caller = createCaller(makeAuthCtx());

  it('accepts optional name', async () => {
    const result = await caller.user.updateProfile({ name: 'New Name' });
    expect(result).toEqual({ todo: true });
  });

  it('accepts empty object (name is optional)', async () => {
    const result = await caller.user.updateProfile({});
    expect(result).toEqual({ todo: true });
  });

  it('rejects empty string name', async () => {
    await expect(caller.user.updateProfile({ name: '' })).rejects.toThrow(TRPCError);
  });

  it('rejects name longer than 100 chars', async () => {
    await expect(caller.user.updateProfile({ name: 'a'.repeat(101) })).rejects.toThrow(TRPCError);
  });
});

describe('user.completeOnboard — input validation', () => {
  const updatedUser = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    name: 'Test User',
    avatarUrl: null,
    goalMode: 'bulk',
    tdeeCalories: 2800,
    calorieTarget: 3200,
    proteinTargetG: 160,
    carbsTargetG: 380,
    fatTargetG: 89,
  };

  function makeOnboardCtx() {
    return makeCtx({
      session: { user: { id: 'user-uuid-1', email: 'user@example.com' } },
      db: {
        user: {
          update: vi.fn().mockResolvedValue(updatedUser),
        },
        goalHistory: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Context['db'],
    });
  }

  const validOnboard = {
    goalMode: 'bulk' as const,
    weightKg: 80,
    heightCm: 175,
    age: 25,
    sex: 'male' as const,
    activityLevel: 'moderate' as const,
  };

  it('accepts valid onboarding input', async () => {
    const caller = createCaller(makeOnboardCtx());
    const result = await caller.user.completeOnboard(validOnboard);
    expect(result).toMatchObject({ id: 'user-uuid-1', isOnboarded: true });
  });

  // Zod rejects before the db is touched — use a lightweight auth context
  const callerZodOnly = createCaller(makeAuthCtx());

  it('rejects invalid goalMode', async () => {
    await expect(
      callerZodOnly.user.completeOnboard({ ...validOnboard, goalMode: 'gain' as never }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects age below 13', async () => {
    await expect(callerZodOnly.user.completeOnboard({ ...validOnboard, age: 12 })).rejects.toThrow(
      TRPCError,
    );
  });

  it('rejects negative weight', async () => {
    await expect(
      callerZodOnly.user.completeOnboard({ ...validOnboard, weightKg: -1 }),
    ).rejects.toThrow(TRPCError);
  });
});

// ─── food ─────────────────────────────────────────────────────────────────────

describe('food.search', () => {
  const caller = createCaller(makeCtx());

  it('returns empty array (stub)', async () => {
    const result = await caller.food.search({ query: 'chicken' });
    expect(result).toEqual([]);
  });

  it('rejects empty query string', async () => {
    await expect(caller.food.search({ query: '' })).rejects.toThrow(TRPCError);
  });
});

describe('food.byBarcode', () => {
  const caller = createCaller(makeCtx());

  it('returns null (stub)', async () => {
    const result = await caller.food.byBarcode({ barcode: '1234567890' });
    expect(result).toBeNull();
  });
});

describe('food.logEntry — input validation', () => {
  const caller = createCaller(makeAuthCtx());

  const validEntry = {
    foodItemId: '550e8400-e29b-41d4-a716-446655440000',
    mealType: 'breakfast' as const,
    quantityGrams: 150,
  };

  it('accepts valid log entry', async () => {
    const result = await caller.food.logEntry(validEntry);
    expect(result).toEqual({ todo: true });
  });

  it.each(['breakfast', 'lunch', 'dinner', 'snacks'] as const)(
    "accepts mealType '%s'",
    async (mealType) => {
      const result = await caller.food.logEntry({ ...validEntry, mealType });
      expect(result).toEqual({ todo: true });
    },
  );

  it('rejects invalid mealType', async () => {
    await expect(
      caller.food.logEntry({ ...validEntry, mealType: 'brunch' as never }),
    ).rejects.toThrow(TRPCError);
  });

  it('rejects non-UUID foodItemId', async () => {
    await expect(caller.food.logEntry({ ...validEntry, foodItemId: 'not-a-uuid' })).rejects.toThrow(
      TRPCError,
    );
  });

  it('rejects zero quantityGrams', async () => {
    await expect(caller.food.logEntry({ ...validEntry, quantityGrams: 0 })).rejects.toThrow(
      TRPCError,
    );
  });

  it('rejects negative quantityGrams', async () => {
    await expect(caller.food.logEntry({ ...validEntry, quantityGrams: -50 })).rejects.toThrow(
      TRPCError,
    );
  });
});

// ─── workout ──────────────────────────────────────────────────────────────────

describe('workout.listRoutines', () => {
  it('returns empty array (stub)', async () => {
    const caller = createCaller(makeCtx());
    const result = await caller.workout.listRoutines();
    expect(result).toEqual([]);
  });
});

describe('workout.startSession — input validation', () => {
  const caller = createCaller(makeAuthCtx());

  it('accepts no routineId', async () => {
    const result = await caller.workout.startSession({});
    expect(result).toEqual({ todo: true });
  });

  it('accepts valid routineId UUID', async () => {
    const result = await caller.workout.startSession({
      routineId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result).toEqual({ todo: true });
  });

  it('rejects non-UUID routineId', async () => {
    await expect(caller.workout.startSession({ routineId: 'not-a-uuid' })).rejects.toThrow(
      TRPCError,
    );
  });
});

describe('workout.logSet — input validation', () => {
  const caller = createCaller(makeAuthCtx());

  const validSet = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    exerciseId: '660e8400-e29b-41d4-a716-446655440001',
    setNumber: 1,
    weightKg: 100,
    reps: 8,
  };

  it('accepts valid set', async () => {
    const result = await caller.workout.logSet(validSet);
    expect(result).toEqual({ todo: true });
  });

  it('accepts set without optional fields', async () => {
    const { weightKg: _wk, reps: _r, ...minimal } = validSet;
    const result = await caller.workout.logSet(minimal);
    expect(result).toEqual({ todo: true });
  });

  it('rejects setNumber of zero', async () => {
    await expect(caller.workout.logSet({ ...validSet, setNumber: 0 })).rejects.toThrow(TRPCError);
  });

  it('rejects negative setNumber', async () => {
    await expect(caller.workout.logSet({ ...validSet, setNumber: -1 })).rejects.toThrow(TRPCError);
  });

  it('rejects non-integer setNumber', async () => {
    await expect(caller.workout.logSet({ ...validSet, setNumber: 1.5 })).rejects.toThrow(TRPCError);
  });

  it('rejects negative weightKg', async () => {
    await expect(caller.workout.logSet({ ...validSet, weightKg: -10 })).rejects.toThrow(TRPCError);
  });

  it('accepts zero weightKg (bodyweight exercise)', async () => {
    const result = await caller.workout.logSet({ ...validSet, weightKg: 0 });
    expect(result).toEqual({ todo: true });
  });

  it('rejects non-UUID sessionId', async () => {
    await expect(caller.workout.logSet({ ...validSet, sessionId: 'bad-id' })).rejects.toThrow(
      TRPCError,
    );
  });
});

describe('workout.endSession — input validation', () => {
  const caller = createCaller(makeAuthCtx());

  it('accepts valid sessionId UUID', async () => {
    const result = await caller.workout.endSession({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result).toEqual({ todo: true });
  });

  it('rejects non-UUID sessionId', async () => {
    await expect(caller.workout.endSession({ sessionId: 'not-a-uuid' })).rejects.toThrow(TRPCError);
  });
});
