/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCallerFactory, appRouter } from '../../router';
import type { Context } from '../../context';

process.env.JWT_SECRET = 'test-secret-for-flow-tests';

// ── In-memory DB simulator ──────────────────────────────────────────────────────
// Simulates the Prisma user table for flow tests without a real DB.

type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  avatarUrl: string | null;
  goalMode: string | null;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: string | null;
  activityLevel: string | null;
  tdeeCalories: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  goalWeightKg: number | null;
  goalTargetDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

let userStore = new Map<string, UserRecord>();
let idCounter = 1;

function resetStore() {
  userStore = new Map();
  idCounter = 1;
}

function makeFlowDb() {
  return {
    user: {
      findUnique: vi.fn(({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) {
          return Promise.resolve(
            [...userStore.values()].find((u) => u.email === where.email) ?? null,
          );
        }
        if (where.id) {
          return Promise.resolve(userStore.get(where.id) ?? null);
        }
        return Promise.resolve(null);
      }),
      create: vi.fn(({ data }: { data: Partial<UserRecord> }) => {
        const id = String(idCounter++);
        const now = new Date();
        const user: UserRecord = {
          id,
          email: data.email ?? '',
          name: data.name ?? '',
          passwordHash: data.passwordHash ?? null,
          avatarUrl: null,
          goalMode: null,
          weightKg: null,
          heightCm: null,
          age: null,
          sex: null,
          activityLevel: null,
          tdeeCalories: null,
          calorieTarget: null,
          proteinTargetG: null,
          carbsTargetG: null,
          fatTargetG: null,
          goalWeightKg: null,
          goalTargetDate: null,
          createdAt: now,
          updatedAt: now,
        };
        userStore.set(id, user);
        return Promise.resolve(user);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<UserRecord> }) => {
        const user = userStore.get(where.id);
        if (!user) return Promise.reject(new Error('User not found in flow db'));
        Object.assign(user, data);
        return Promise.resolve(user);
      }),
    },
    goalHistory: {
      create: vi.fn().mockResolvedValue({ id: 'gh-1' }),
    },
    routine: { findMany: vi.fn().mockResolvedValue([]) },
    exercise: { findMany: vi.fn().mockResolvedValue([]) },
  } as any;
}

// ── Context helpers ────────────────────────────────────────────────────────────

function makeCtx(db: Context['db']): Context {
  return {
    db,
    redis: {} as never,
    session: null,
    req: {} as never,
    res: {} as never,
  };
}

function makeAuthCtx(userId: string, email: string, db: Context['db']): Context {
  return { ...makeCtx(db), session: { user: { id: userId, email } } };
}

const createCaller = createCallerFactory(appRouter);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXTURE = {
  name: 'Test User',
  email: 'test@fitapp.com',
  password: 'password123',
};

const ONBOARD = {
  goalMode: 'bulk' as const,
  weightKg: 80,
  heightCm: 180,
  age: 25,
  sex: 'male' as const,
  activityLevel: 'moderate' as const,
};

// Manual TDEE for the fixture (Mifflin-St Jeor, male, moderate × 1.55, bulk +400):
// BMR  = 10(80) + 6.25(180) − 5(25) + 5 = 1805
// TDEE = round(1805 × 1.55) = 2798
// calorieTarget   = 2798 + 400 = 3198
// proteinTargetG  = round(80 × 2) = 160
// fatTargetG      = round(3198 × 0.25 / 9) = round(88.83) = 89
// carbsTargetG    = round((3198 − 640 − 801) / 4) = round(439.25) = 439
const EXPECTED = {
  tdeeCalories: 2798,
  calorieTarget: 3198,
  proteinTargetG: 160,
  fatTargetG: 89,
  carbsTargetG: 439,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Auth + Onboarding flow', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('full happy path: signUp → signIn → me → completeOnboard → me', async () => {
    const db = makeFlowDb();
    const pub = createCaller(makeCtx(db));

    // 1. signUp
    const { token: signUpToken, user: signedUpUser } = await pub.auth.signUp(FIXTURE);
    expect(signedUpUser.email).toBe(FIXTURE.email);
    expect(signedUpUser.name).toBe(FIXTURE.name);
    expect(signedUpUser.goalMode).toBeNull();
    expect(signedUpUser.isOnboarded).toBe(false);
    expect(signUpToken).toBeTruthy();

    const userId = signedUpUser.id;

    // 2. signIn with same credentials
    const { token: signInToken, user: signedInUser } = await pub.auth.signIn({
      email: FIXTURE.email,
      password: FIXTURE.password,
    });
    expect(signedInUser.id).toBe(userId);
    expect(signInToken).toBeTruthy();

    // 3. me — not yet onboarded
    const auth = createCaller(makeAuthCtx(userId, FIXTURE.email, db));
    const meBefore = await auth.auth.me();
    expect(meBefore.isOnboarded).toBe(false);
    expect(meBefore.goalMode).toBeNull();

    // 4. completeOnboard
    const onboarded = await auth.user.completeOnboard(ONBOARD);
    expect(onboarded.isOnboarded).toBe(true);
    expect(onboarded.goalMode).toBe('bulk');
    expect(onboarded.tdeeCalories).toBe(EXPECTED.tdeeCalories);
    expect(onboarded.calorieTarget).toBe(EXPECTED.calorieTarget);
    expect(onboarded.proteinTargetG).toBe(EXPECTED.proteinTargetG);
    expect(onboarded.fatTargetG).toBe(EXPECTED.fatTargetG);
    expect(onboarded.carbsTargetG).toBe(EXPECTED.carbsTargetG);

    // 5. me — now onboarded with targets
    const meAfter = await auth.auth.me();
    expect(meAfter.isOnboarded).toBe(true);
    expect(meAfter.goalMode).toBe('bulk');
    expect(meAfter.calorieTarget).toBe(EXPECTED.calorieTarget);
  });

  it('duplicate email → CONFLICT', async () => {
    const db = makeFlowDb();
    const pub = createCaller(makeCtx(db));
    await pub.auth.signUp(FIXTURE);
    await expect(pub.auth.signUp(FIXTURE)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('signIn with unknown email → UNAUTHORIZED', async () => {
    const db = makeFlowDb();
    const pub = createCaller(makeCtx(db));
    await expect(
      pub.auth.signIn({ email: 'ghost@fitapp.com', password: FIXTURE.password }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('auth.me with unknown userId → NOT_FOUND', async () => {
    const db = makeFlowDb();
    const auth = createCaller(makeAuthCtx('nonexistent-id', 'ghost@fitapp.com', db));
    await expect(auth.auth.me()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('completeOnboard without prior signUp → NOT_FOUND (user.update throws)', async () => {
    const db = makeFlowDb();
    const auth = createCaller(makeAuthCtx('no-such-id', 'nobody@fitapp.com', db));
    await expect(auth.user.completeOnboard(ONBOARD)).rejects.toThrow();
  });
});
