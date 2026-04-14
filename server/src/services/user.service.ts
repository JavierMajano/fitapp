import { TRPCError } from '@trpc/server';

import type { OnboardingInput } from '../schemas';
import { users } from './auth.service';
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

function calcTargets(input: OnboardingInput) {
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

export async function completeOnboard(
  userId: string,
  input: OnboardingInput,
  _db: unknown,
): Promise<SafeUser> {
  const user = users.get(userId);
  if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });

  const targets = calcTargets(input);

  Object.assign(user, {
    goalMode: input.goalMode,
    isOnboarded: true,
    ...targets,
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
