import { describe, it, expect } from 'vitest';

import { signUpSchema, signInSchema } from '../../schemas/auth.schemas';

// ─── signUpSchema ────────────────────────────────────────────────────────────

describe('signUpSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'password123',
    name: 'Jane Doe',
  };

  it('accepts valid input', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  describe('email', () => {
    it('rejects missing email', () => {
      const { email: _, ...rest } = valid;
      expect(signUpSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects malformed email', () => {
      expect(signUpSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    });

    it('rejects email without domain', () => {
      expect(signUpSchema.safeParse({ ...valid, email: 'user@' }).success).toBe(false);
    });
  });

  describe('password', () => {
    it('rejects password shorter than 8 chars', () => {
      expect(signUpSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
    });

    it('accepts password of exactly 8 chars', () => {
      expect(signUpSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(true);
    });

    it('rejects password longer than 128 chars', () => {
      expect(signUpSchema.safeParse({ ...valid, password: 'a'.repeat(129) }).success).toBe(false);
    });

    it('accepts password of exactly 128 chars', () => {
      expect(signUpSchema.safeParse({ ...valid, password: 'a'.repeat(128) }).success).toBe(true);
    });

    it('rejects missing password', () => {
      const { password: _, ...rest } = valid;
      expect(signUpSchema.safeParse(rest).success).toBe(false);
    });
  });

  describe('name', () => {
    it('rejects empty name', () => {
      expect(signUpSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    });

    it('rejects name longer than 100 chars', () => {
      expect(signUpSchema.safeParse({ ...valid, name: 'a'.repeat(101) }).success).toBe(false);
    });

    it('accepts name of exactly 100 chars', () => {
      expect(signUpSchema.safeParse({ ...valid, name: 'a'.repeat(100) }).success).toBe(true);
    });

    it('rejects missing name', () => {
      const { name: _, ...rest } = valid;
      expect(signUpSchema.safeParse(rest).success).toBe(false);
    });
  });
});

// ─── signInSchema ────────────────────────────────────────────────────────────

describe('signInSchema', () => {
  const valid = { email: 'user@example.com', password: 'anypassword' };

  it('accepts valid input', () => {
    expect(signInSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing email', () => {
    expect(signInSchema.safeParse({ password: 'pass' }).success).toBe(false);
  });

  it('rejects malformed email', () => {
    expect(signInSchema.safeParse({ ...valid, email: 'bad-email' }).success).toBe(false);
  });

  it('rejects empty password', () => {
    expect(signInSchema.safeParse({ ...valid, password: '' }).success).toBe(false);
  });

  it('accepts any non-empty password (no min length on sign-in)', () => {
    expect(signInSchema.safeParse({ ...valid, password: 'x' }).success).toBe(true);
  });

  it('rejects missing password', () => {
    expect(signInSchema.safeParse({ email: valid.email }).success).toBe(false);
  });
});
