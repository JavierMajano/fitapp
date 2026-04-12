import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';

import type { OnboardingInput } from '../schemas';

import type { SafeUser } from './auth.service';

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

function calcTargets(input: OnboardingInput): {
  tdeeCalories: number;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
} {
  const { weightKg, heightCm, age, sex, activityLevel, goalMode } = input;

  // Mifflin-St Jeor BMR
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

export async function completeOnboard(
  userId: string,
  input: OnboardingInput,
  db: PrismaClient,
): Promise<SafeUser> {
  const targets = calcTargets(input);

  const user = await db.user.update({
    where: { id: userId },
    data: {
      goalMode: input.goalMode,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      age: input.age,
      sex: input.sex,
      activityLevel: input.activityLevel,
      ...targets,
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      goalMode: true,
      tdeeCalories: true,
      calorieTarget: true,
      proteinTargetG: true,
      carbsTargetG: true,
      fatTargetG: true,
    },
  });

  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
  }

  await db.goalHistory.create({
    data: {
      userId,
      goalMode: input.goalMode,
      calorieTarget: targets.calorieTarget,
      proteinTargetG: targets.proteinTargetG,
      carbsTargetG: targets.carbsTargetG,
      fatTargetG: targets.fatTargetG,
      startedAt: new Date(),
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    goalMode: user.goalMode,
    tdeeCalories: user.tdeeCalories,
    calorieTarget: user.calorieTarget,
    proteinTargetG: user.proteinTargetG,
    carbsTargetG: user.carbsTargetG,
    fatTargetG: user.fatTargetG,
    isOnboarded: true,
  };
}
