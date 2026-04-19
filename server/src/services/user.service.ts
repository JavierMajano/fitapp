import { TRPCError } from '@trpc/server';

import type { PrismaClient } from '../db';
import type { OnboardingInput, UpdateProfileInput, UpdateSettingsInput } from '../schemas';
import type { SafeUser } from './auth.service';

// ─── TDEE helpers ─────────────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<OnboardingInput['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<OnboardingInput['goalMode'], number> = {
  bulk: 400,
  maintenance: 0,
  cut: -400,
};

function calcTargets(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: OnboardingInput['activityLevel'];
  goalMode: OnboardingInput['goalMode'];
}) {
  const { weightKg, heightCm, age, sex, activityLevel, goalMode } = input;

  const bmr =
    sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdeeCalories = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
  const calorieTarget = tdeeCalories + GOAL_ADJUSTMENTS[goalMode];

  const proteinTargetG = Math.round(weightKg * 2);
  const fatTargetG = Math.round((calorieTarget * 0.25) / 9);
  const carbsTargetG = Math.round((calorieTarget - proteinTargetG * 4 - fatTargetG * 9) / 4);

  return { tdeeCalories, calorieTarget, proteinTargetG, carbsTargetG, fatTargetG };
}

function toSafe(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  goalMode: string | null;
  weightKg: number | null;
  tdeeCalories: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  goalWeightKg: number | null;
  goalTargetDate: Date | null;
}): SafeUser {
  return { ...user, isOnboarded: user.goalMode !== null };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function completeOnboard(
  userId: string,
  input: OnboardingInput,
  db: PrismaClient,
): Promise<SafeUser> {
  const targets = calcTargets(input);

  const [user] = await Promise.all([
    db.user.update({
      where: { id: userId },
      data: {
        goalMode: input.goalMode,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        age: input.age,
        sex: input.sex,
        activityLevel: input.activityLevel,
        goalWeightKg: input.goalWeightKg ?? null,
        goalTargetDate: input.goalTargetDate ? new Date(input.goalTargetDate) : null,
        ...targets,
      },
    }),
    db.goalHistory.create({
      data: {
        userId,
        goalMode: input.goalMode,
        calorieTarget: targets.calorieTarget,
        proteinTargetG: targets.proteinTargetG,
        carbsTargetG: targets.carbsTargetG,
        fatTargetG: targets.fatTargetG,
        startedAt: new Date(),
      },
    }),
  ]);

  return toSafe(user);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
  db: PrismaClient,
): Promise<SafeUser> {
  // Fetch current user to fill any missing fields for TDEE recalc
  const current = await db.user.findUnique({ where: { id: userId } });
  if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.weightKg !== undefined) updateData.weightKg = input.weightKg;
  if (input.heightCm !== undefined) updateData.heightCm = input.heightCm;
  if (input.age !== undefined) updateData.age = input.age;
  if (input.sex !== undefined) updateData.sex = input.sex;
  if (input.activityLevel !== undefined) updateData.activityLevel = input.activityLevel;
  if (input.goalMode !== undefined) updateData.goalMode = input.goalMode;
  if ('goalWeightKg' in input) updateData.goalWeightKg = input.goalWeightKg;
  if ('goalTargetDate' in input) {
    updateData.goalTargetDate =
      input.goalTargetDate != null ? new Date(input.goalTargetDate) : null;
  }

  // Recalculate TDEE if any body metrics or goal mode changed
  const shouldRecalc =
    (input.weightKg !== undefined ||
      input.heightCm !== undefined ||
      input.age !== undefined ||
      input.sex !== undefined ||
      input.activityLevel !== undefined ||
      input.goalMode !== undefined) &&
    // All required fields must be present (either from input or current user)
    (input.weightKg ?? current.weightKg) !== null &&
    (input.heightCm ?? current.heightCm) !== null &&
    (input.age ?? current.age) !== null &&
    (input.sex ?? current.sex) !== null &&
    (input.activityLevel ?? current.activityLevel) !== null &&
    (input.goalMode ?? current.goalMode) !== null;

  if (shouldRecalc) {
    const targets = calcTargets({
      weightKg: (input.weightKg ?? current.weightKg) as number,
      heightCm: (input.heightCm ?? current.heightCm) as number,
      age: (input.age ?? current.age) as number,
      sex: (input.sex ?? current.sex) as 'male' | 'female',
      activityLevel: (input.activityLevel ??
        current.activityLevel) as OnboardingInput['activityLevel'],
      goalMode: (input.goalMode ?? current.goalMode) as OnboardingInput['goalMode'],
    });
    Object.assign(updateData, targets);
  }

  const user = await db.user.update({ where: { id: userId }, data: updateData });
  return toSafe(user);
}

export type UserSettings = {
  id: string;
  userId: string;
  unitSystem: string;
  theme: string;
  weeklyWeighInDay: number;
  defaultRestSeconds: number;
  notificationReminders: number;
  timezone: string;
};

export async function getSettings(userId: string, db: PrismaClient): Promise<UserSettings> {
  const existing = await db.userSettings.findUnique({ where: { userId } });
  if (existing) return existing;

  // Create default settings on first access
  return db.userSettings.create({ data: { userId } });
}

export async function updateSettings(
  userId: string,
  input: UpdateSettingsInput,
  db: PrismaClient,
): Promise<UserSettings> {
  return db.userSettings.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
}
