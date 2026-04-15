import { z } from 'zod';

export const foodItemResultSchema = z.object({
  name: z.string(),
  brand: z.string().nullable(),
  barcode: z.string().nullable(),
  source: z.enum(['open_food_facts', 'usda']),
  sourceRefId: z.string(),
  caloriesPer100g: z.number(),
  proteinPer100g: z.number(),
  carbsPer100g: z.number(),
  fatPer100g: z.number(),
  fiberPer100g: z.number().nullable(),
  sugarPer100g: z.number().nullable(),
  sodiumPer100g: z.number().nullable(),
});

export type FoodItemResult = z.infer<typeof foodItemResultSchema>;
