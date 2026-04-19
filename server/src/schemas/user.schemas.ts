import { z } from 'zod';

export const onboardingSchema = z.object({
  goalMode: z.enum(['bulk', 'maintenance', 'cut']),
  weightKg: z.number().positive().max(500),
  heightCm: z.number().positive().max(300),
  age: z.number().int().min(13).max(120),
  sex: z.enum(['male', 'female']),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goalWeightKg: z.number().positive().max(500).nullable().optional(),
  goalTargetDate: z.string().datetime().nullable().optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  weightKg: z.number().positive().max(500).optional(),
  heightCm: z.number().positive().max(300).optional(),
  age: z.number().int().min(13).max(120).optional(),
  sex: z.enum(['male', 'female']).optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  goalMode: z.enum(['bulk', 'maintenance', 'cut']).optional(),
  goalWeightKg: z.number().positive().max(500).nullable().optional(),
  goalTargetDate: z.string().datetime().nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateSettingsSchema = z.object({
  unitSystem: z.enum(['metric', 'imperial']).optional(),
  weeklyWeighInDay: z.number().int().min(0).max(6).optional(),
  defaultRestSeconds: z.number().int().min(0).max(600).optional(),
  timezone: z.string().max(100).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
