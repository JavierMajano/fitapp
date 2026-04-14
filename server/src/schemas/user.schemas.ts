import { z } from 'zod';

export const onboardingSchema = z.object({
  goalMode: z.enum(['bulk', 'maintenance', 'cut']),
  weightKg: z.number().positive().max(500),
  heightCm: z.number().positive().max(300),
  age: z.number().int().min(13).max(120),
  sex: z.enum(['male', 'female']),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
