import { describe, it, expect } from 'vitest';

import { onboardingSchema } from '../../schemas/user.schemas';

describe('onboardingSchema', () => {
  const valid = {
    goalMode: 'bulk' as const,
    weightKg: 80,
    heightCm: 175,
    age: 25,
    sex: 'male' as const,
    activityLevel: 'moderate' as const,
  };

  it('accepts valid input', () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true);
  });

  // ── goalMode ──────────────────────────────────────────────────────────────

  describe('goalMode', () => {
    it.each(['bulk', 'maintenance', 'cut'] as const)("accepts '%s'", (goalMode) => {
      expect(onboardingSchema.safeParse({ ...valid, goalMode }).success).toBe(true);
    });

    it('rejects unknown goal mode', () => {
      expect(onboardingSchema.safeParse({ ...valid, goalMode: 'shred' }).success).toBe(false);
    });

    it('rejects missing goalMode', () => {
      const { goalMode: _, ...rest } = valid;
      expect(onboardingSchema.safeParse(rest).success).toBe(false);
    });
  });

  // ── weightKg ──────────────────────────────────────────────────────────────

  describe('weightKg', () => {
    it('rejects zero', () => {
      expect(onboardingSchema.safeParse({ ...valid, weightKg: 0 }).success).toBe(false);
    });

    it('rejects negative', () => {
      expect(onboardingSchema.safeParse({ ...valid, weightKg: -10 }).success).toBe(false);
    });

    it('rejects above 500', () => {
      expect(onboardingSchema.safeParse({ ...valid, weightKg: 501 }).success).toBe(false);
    });

    it('accepts exactly 500', () => {
      expect(onboardingSchema.safeParse({ ...valid, weightKg: 500 }).success).toBe(true);
    });

    it('accepts fractional weight', () => {
      expect(onboardingSchema.safeParse({ ...valid, weightKg: 72.5 }).success).toBe(true);
    });
  });

  // ── heightCm ──────────────────────────────────────────────────────────────

  describe('heightCm', () => {
    it('rejects zero', () => {
      expect(onboardingSchema.safeParse({ ...valid, heightCm: 0 }).success).toBe(false);
    });

    it('rejects above 300', () => {
      expect(onboardingSchema.safeParse({ ...valid, heightCm: 301 }).success).toBe(false);
    });

    it('accepts exactly 300', () => {
      expect(onboardingSchema.safeParse({ ...valid, heightCm: 300 }).success).toBe(true);
    });
  });

  // ── age ───────────────────────────────────────────────────────────────────

  describe('age', () => {
    it('rejects below 13', () => {
      expect(onboardingSchema.safeParse({ ...valid, age: 12 }).success).toBe(false);
    });

    it('accepts exactly 13', () => {
      expect(onboardingSchema.safeParse({ ...valid, age: 13 }).success).toBe(true);
    });

    it('rejects above 120', () => {
      expect(onboardingSchema.safeParse({ ...valid, age: 121 }).success).toBe(false);
    });

    it('accepts exactly 120', () => {
      expect(onboardingSchema.safeParse({ ...valid, age: 120 }).success).toBe(true);
    });

    it('rejects fractional age', () => {
      expect(onboardingSchema.safeParse({ ...valid, age: 25.5 }).success).toBe(false);
    });
  });

  // ── sex ───────────────────────────────────────────────────────────────────

  describe('sex', () => {
    it.each(['male', 'female'] as const)("accepts '%s'", (sex) => {
      expect(onboardingSchema.safeParse({ ...valid, sex }).success).toBe(true);
    });

    it('rejects unknown sex value', () => {
      expect(onboardingSchema.safeParse({ ...valid, sex: 'other' }).success).toBe(false);
    });
  });

  // ── activityLevel ─────────────────────────────────────────────────────────

  describe('activityLevel', () => {
    it.each(['sedentary', 'light', 'moderate', 'active', 'very_active'] as const)(
      "accepts '%s'",
      (activityLevel) => {
        expect(onboardingSchema.safeParse({ ...valid, activityLevel }).success).toBe(true);
      },
    );

    it('rejects unknown activity level', () => {
      expect(onboardingSchema.safeParse({ ...valid, activityLevel: 'extreme' }).success).toBe(
        false,
      );
    });
  });
});
