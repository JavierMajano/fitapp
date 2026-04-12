import jwt from 'jsonwebtoken';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as authService from '../../services/auth.service';

// ─── Environment ──────────────────────────────────────────────────────────────

// jwt.sign requires JWT_SECRET to be set
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const baseDbUser = {
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
};

// Minimal PrismaClient mock — only the methods auth.service.ts calls
function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      ...overrides,
    },
  } as unknown as Parameters<typeof authService.signUp>[1];
}

// ─── signUp ───────────────────────────────────────────────────────────────────

describe('authService.signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a user and returns SafeUser shape', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(baseDbUser as never);

    const result = await authService.signUp(
      { email: 'user@example.com', password: 'password123', name: 'Test User' },
      db,
    );

    expect(result.user).toMatchObject({
      id: 'user-uuid-1',
      email: 'user@example.com',
      name: 'Test User',
      isOnboarded: false,
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('hashes the password before storing (never stores plaintext)', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(baseDbUser as never);

    await authService.signUp(
      { email: 'user@example.com', password: 'plaintext123', name: 'User' },
      db,
    );

    const createCall = vi.mocked(db.user.create).mock.calls[0][0];
    expect(createCall.data.passwordHash).toBeDefined();
    expect(createCall.data.passwordHash).not.toBe('plaintext123');
    expect(createCall.data.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
  });

  it('throws CONFLICT when email is already registered', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(baseDbUser as never);

    await expect(
      authService.signUp({ email: 'user@example.com', password: 'password123', name: 'User' }, db),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('derives isOnboarded: false when goalMode is null', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue({
      ...baseDbUser,
      goalMode: null,
    } as never);

    const result = await authService.signUp(
      { email: 'a@b.com', password: 'pass1234', name: 'A' },
      db,
    );
    expect(result.user.isOnboarded).toBe(false);
  });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('authService.signIn', () => {
  // Pre-hash of "correct-password" — generated once so tests don't need to hash
  // bcrypt.hashSync("correct-password", 12)
  const PASSWORD = 'correct-password';
  const WRONG_PASSWORD = 'wrong-password';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function setupWithHashedPassword() {
    // Hash inline so the test is self-contained
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(PASSWORD, 1); // rounds=1 for test speed
    return {
      ...baseDbUser,
      passwordHash,
    };
  }

  it('returns { token, user } on valid credentials', async () => {
    const dbUser = await setupWithHashedPassword();
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(dbUser as never);

    const result = await authService.signIn({ email: 'user@example.com', password: PASSWORD }, db);

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.user.email).toBe('user@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('token is a valid signed JWT containing the user id', async () => {
    const dbUser = await setupWithHashedPassword();
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(dbUser as never);

    const { token } = await authService.signIn(
      { email: 'user@example.com', password: PASSWORD },
      db,
    );

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      email: string;
    };
    expect(payload.sub).toBe('user-uuid-1');
    expect(payload.email).toBe('user@example.com');
  });

  it('throws UNAUTHORIZED on wrong password', async () => {
    const dbUser = await setupWithHashedPassword();
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(dbUser as never);

    await expect(
      authService.signIn({ email: 'user@example.com', password: WRONG_PASSWORD }, db),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when user does not exist', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    await expect(
      authService.signIn({ email: 'ghost@example.com', password: PASSWORD }, db),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED for OAuth user with no passwordHash', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseDbUser,
      passwordHash: null,
    } as never);

    await expect(
      authService.signIn({ email: 'oauth@example.com', password: PASSWORD }, db),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns isOnboarded: true when goalMode is set', async () => {
    const dbUser = await setupWithHashedPassword();
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...dbUser,
      goalMode: 'bulk',
    } as never);

    const { user } = await authService.signIn(
      { email: 'user@example.com', password: PASSWORD },
      db,
    );
    expect(user.isOnboarded).toBe(true);
    expect(user.goalMode).toBe('bulk');
  });
});

// ─── getSafeUser ──────────────────────────────────────────────────────────────

describe('authService.getSafeUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns SafeUser when user exists', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(baseDbUser as never);

    const result = await authService.getSafeUser('user-uuid-1', db);

    expect(result).toMatchObject({
      id: 'user-uuid-1',
      email: 'user@example.com',
      isOnboarded: false,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws NOT_FOUND when user does not exist', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    await expect(authService.getSafeUser('nonexistent-id', db)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('queries by the provided userId', async () => {
    const db = makeDb();
    vi.mocked(db.user.findUnique).mockResolvedValue(baseDbUser as never);

    await authService.getSafeUser('user-uuid-1', db);

    expect(vi.mocked(db.user.findUnique)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-uuid-1' } }),
    );
  });
});
