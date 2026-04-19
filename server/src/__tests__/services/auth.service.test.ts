/* eslint-disable @typescript-eslint/no-explicit-any */
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authService from '../../services/auth.service';

// JWT_SECRET is provided by vitest.config.ts env — no override needed here

const FIXTURE = {
  email: 'user@example.com',
  password: 'password123',
  name: 'Test User',
};

const BASE_USER = {
  id: 'user-1',
  email: FIXTURE.email,
  name: FIXTURE.name,
  avatarUrl: null,
  goalMode: null,
  weightKg: null,
  tdeeCalories: null,
  calorieTarget: null,
  proteinTargetG: null,
  carbsTargetG: null,
  fatTargetG: null,
  goalWeightKg: null,
  goalTargetDate: null,
  passwordHash: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMockDb(
  overrides: {
    findUnique?: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    user: {
      findUnique: overrides.findUnique ?? vi.fn().mockResolvedValue(null),
      create: overrides.create ?? vi.fn(),
    },
  } as any;
}

// ─── signUp ───────────────────────────────────────────────────────────────────

describe('authService.signUp', () => {
  it('creates a user and returns SafeUser shape', async () => {
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ ...BASE_USER, id: 'new-1' }),
    });
    const result = await authService.signUp(FIXTURE, db);
    expect(result.user).toMatchObject({
      email: FIXTURE.email,
      name: FIXTURE.name,
      goalMode: null,
      isOnboarded: false,
    });
    expect(result.token).toBeTruthy();
  });

  it('does not expose the password in the returned user', async () => {
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ ...BASE_USER, id: 'new-1' }),
    });
    const { user } = await authService.signUp(FIXTURE, db);
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('returns a signed JWT with the user id and email', async () => {
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ ...BASE_USER, id: 'new-1' }),
    });
    const { token, user } = await authService.signUp(FIXTURE, db);
    const payload = jwt.verify(token, process.env['JWT_SECRET']!) as { sub: string; email: string };
    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe(FIXTURE.email);
  });

  it('throws CONFLICT when email is already registered', async () => {
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue(BASE_USER), // existing user
    });
    await expect(authService.signUp(FIXTURE, db)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('derives isOnboarded: false when goalMode is null', async () => {
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ ...BASE_USER, id: 'new-1', goalMode: null }),
    });
    const { user } = await authService.signUp(FIXTURE, db);
    expect(user.isOnboarded).toBe(false);
  });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('authService.signIn', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns { token, user } for a known email + correct password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(FIXTURE.password, 1);
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue({ ...BASE_USER, passwordHash: hash }),
    });
    const result = await authService.signIn(
      { email: FIXTURE.email, password: FIXTURE.password },
      db,
    );
    expect(result).toHaveProperty('token');
    expect(result.user.email).toBe(FIXTURE.email);
    expect(result.user).not.toHaveProperty('password');
  });

  it('token is a signed JWT containing the user id', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(FIXTURE.password, 1);
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue({ ...BASE_USER, id: 'u-99', passwordHash: hash }),
    });
    const { token } = await authService.signIn(
      { email: FIXTURE.email, password: FIXTURE.password },
      db,
    );
    const payload = jwt.verify(token, process.env['JWT_SECRET']!) as { sub: string };
    expect(payload.sub).toBe('u-99');
  });

  it('throws UNAUTHORIZED for unknown email', async () => {
    const db = makeMockDb({ findUnique: vi.fn().mockResolvedValue(null) });
    await expect(
      authService.signIn({ email: 'ghost@example.com', password: FIXTURE.password }, db),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED for wrong password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct-password', 1);
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue({ ...BASE_USER, passwordHash: hash }),
    });
    await expect(
      authService.signIn({ email: FIXTURE.email, password: 'wrong-password' }, db),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ─── getSafeUser ──────────────────────────────────────────────────────────────

describe('authService.getSafeUser', () => {
  it('returns SafeUser when user exists', async () => {
    const db = makeMockDb({
      findUnique: vi.fn().mockResolvedValue({ ...BASE_USER, id: 'u-42' }),
    });
    const result = await authService.getSafeUser('u-42', db);
    expect(result).toMatchObject({ id: 'u-42', email: FIXTURE.email, isOnboarded: false });
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws NOT_FOUND for nonexistent userId', async () => {
    const db = makeMockDb({ findUnique: vi.fn().mockResolvedValue(null) });
    await expect(authService.getSafeUser('nonexistent-id', db)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
