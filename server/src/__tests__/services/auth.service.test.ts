import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';

import * as authService from '../../services/auth.service';
import { clearUsers } from '../../services/auth.service';

// jwt.sign requires JWT_SECRET to be set
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const FIXTURE = {
  email: 'user@example.com',
  password: 'password123',
  name: 'Test User',
};

// ─── signUp ───────────────────────────────────────────────────────────────────

describe('authService.signUp', () => {
  beforeEach(() => clearUsers());

  it('creates a user and returns SafeUser shape', async () => {
    const result = await authService.signUp(FIXTURE, {});
    expect(result.user).toMatchObject({
      email: FIXTURE.email,
      name: FIXTURE.name,
      goalMode: null,
      isOnboarded: false,
    });
    expect(result.token).toBeTruthy();
  });

  it('does not expose the password in the returned user', async () => {
    const { user } = await authService.signUp(FIXTURE, {});
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('returns a signed JWT with the user id and email', async () => {
    const { token, user } = await authService.signUp(FIXTURE, {});
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; email: string };
    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe(FIXTURE.email);
  });

  it('throws CONFLICT when email is already registered', async () => {
    await authService.signUp(FIXTURE, {});
    await expect(authService.signUp(FIXTURE, {})).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('derives isOnboarded: false when goalMode is null', async () => {
    const { user } = await authService.signUp(FIXTURE, {});
    expect(user.isOnboarded).toBe(false);
  });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('authService.signIn', () => {
  let userId: string;

  beforeEach(async () => {
    clearUsers();
    const { user } = await authService.signUp(FIXTURE, {});
    userId = user.id;
  });

  it('returns { token, user } for a known email', async () => {
    const result = await authService.signIn(
      { email: FIXTURE.email, password: FIXTURE.password },
      {},
    );
    expect(result).toHaveProperty('token');
    expect(result.user.email).toBe(FIXTURE.email);
    expect(result.user).not.toHaveProperty('password');
  });

  it('token is a signed JWT containing the user id', async () => {
    const { token } = await authService.signIn(
      { email: FIXTURE.email, password: FIXTURE.password },
      {},
    );
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; email: string };
    expect(payload.sub).toBe(userId);
    expect(payload.email).toBe(FIXTURE.email);
  });

  it('throws UNAUTHORIZED for unknown email', async () => {
    await expect(
      authService.signIn({ email: 'ghost@example.com', password: FIXTURE.password }, {}),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED for wrong password', async () => {
    await expect(
      authService.signIn({ email: FIXTURE.email, password: 'wrong-password' }, {}),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ─── getSafeUser ──────────────────────────────────────────────────────────────

describe('authService.getSafeUser', () => {
  let userId: string;

  beforeEach(async () => {
    clearUsers();
    const { user } = await authService.signUp(FIXTURE, {});
    userId = user.id;
  });

  it('returns SafeUser when user exists', async () => {
    const result = await authService.getSafeUser(userId, {});
    expect(result).toMatchObject({
      id: userId,
      email: FIXTURE.email,
      isOnboarded: false,
    });
    expect(result).not.toHaveProperty('password');
  });

  it('throws NOT_FOUND for nonexistent userId', async () => {
    await expect(authService.getSafeUser('nonexistent-id', {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
