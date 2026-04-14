import { beforeEach, describe, expect, it } from 'vitest';

import { createCallerFactory, appRouter } from '../../router';
import { clearUsers } from '../../services/auth.service';
import type { Context } from '../../context';

process.env.JWT_SECRET = 'test-secret-for-flow-tests';

// ── Context helpers ────────────────────────────────────────────────────────────

function makeCtx(): Context {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redis: {} as any,
    session: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res: {} as any,
  };
}

function makeAuthCtx(userId: string, email: string): Context {
  return { ...makeCtx(), session: { user: { id: userId, email } } };
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
    clearUsers();
  });

  it('full happy path: signUp → signIn → me → completeOnboard → me', async () => {
    const pub = createCaller(makeCtx());

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
    const auth = createCaller(makeAuthCtx(userId, FIXTURE.email));
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
    const pub = createCaller(makeCtx());
    await pub.auth.signUp(FIXTURE);
    await expect(pub.auth.signUp(FIXTURE)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('signIn with unknown email → UNAUTHORIZED', async () => {
    const pub = createCaller(makeCtx());
    await expect(
      pub.auth.signIn({ email: 'ghost@fitapp.com', password: FIXTURE.password }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('auth.me with unknown userId → NOT_FOUND', async () => {
    const auth = createCaller(makeAuthCtx('nonexistent-id', 'ghost@fitapp.com'));
    await expect(auth.auth.me()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('completeOnboard without prior signUp → NOT_FOUND', async () => {
    const auth = createCaller(makeAuthCtx('no-such-id', 'nobody@fitapp.com'));
    await expect(auth.user.completeOnboard(ONBOARD)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
