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

// Inline food item data sent by client when logging an entry.
// The backend will upsert the FoodItem using source+sourceRefId as unique key.
const inlineFoodItemSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  source: z.string().default('custom'),
  sourceRefId: z.string().optional(),
  caloriesPer100g: z.number().nonnegative(),
  proteinPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  fiberPer100g: z.number().nonnegative().nullable().optional(),
});

export const logFoodEntrySchema = z.object({
  foodItem: inlineFoodItemSchema,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']),
  quantityGrams: z.number().positive(),
  // Pre-calculated macros (client computes from per100g × qty / 100)
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});

export type LogFoodEntryInput = z.infer<typeof logFoodEntrySchema>;

export const updateFoodEntrySchema = z.object({
  entryId: z.string().uuid(),
  quantityGrams: z.number().positive().optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']).optional(),
});

export type UpdateFoodEntryInput = z.infer<typeof updateFoodEntrySchema>;
