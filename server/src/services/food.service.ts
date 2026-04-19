import { TRPCError } from '@trpc/server';
import type Redis from 'ioredis';

import type { PrismaClient } from '../db';
import { env } from '../env';
import { TTL } from '../redis';
import type { FoodItemResult, LogFoodEntryInput, UpdateFoodEntryInput } from '../schemas';

// ─── Open Food Facts ──────────────────────────────────────────────────────────

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  sodium_100g?: number;
}

interface OFFProduct {
  product_name?: string;
  brands?: string;
  code?: string;
  nutriments?: OFFNutriments;
}

interface OFFResponse {
  status: number;
  product?: OFFProduct;
}

function normalizeOFF(product: OFFProduct, barcode: string): FoodItemResult {
  const n = product.nutriments ?? {};
  return {
    name: product.product_name ?? 'Unknown',
    brand: product.brands ?? null,
    barcode,
    source: 'open_food_facts',
    sourceRefId: barcode,
    caloriesPer100g: n['energy-kcal_100g'] ?? 0,
    proteinPer100g: n['proteins_100g'] ?? 0,
    carbsPer100g: n['carbohydrates_100g'] ?? 0,
    fatPer100g: n['fat_100g'] ?? 0,
    fiberPer100g: n['fiber_100g'] ?? null,
    sugarPer100g: n['sugars_100g'] ?? null,
    sodiumPer100g: n['sodium_100g'] ?? null,
  };
}

// ─── USDA FoodData Central ────────────────────────────────────────────────────

interface USDANutrient {
  nutrientName: string;
  unitName: string;
  value: number;
}

interface USDAFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  foodNutrients?: USDANutrient[];
}

interface USDAResponse {
  foods?: USDAFood[];
}

function findNutrient(nutrients: USDANutrient[], name: string): number | undefined {
  return nutrients.find((n) => n.nutrientName === name)?.value;
}

function normalizeUSDA(food: USDAFood): FoodItemResult {
  const nutrients = food.foodNutrients ?? [];
  const sodiumMg = findNutrient(nutrients, 'Sodium, Na');
  return {
    name: food.description,
    brand: food.brandOwner ?? null,
    barcode: null,
    source: 'usda',
    sourceRefId: String(food.fdcId),
    caloriesPer100g: findNutrient(nutrients, 'Energy') ?? 0,
    proteinPer100g: findNutrient(nutrients, 'Protein') ?? 0,
    carbsPer100g: findNutrient(nutrients, 'Carbohydrate, by difference') ?? 0,
    fatPer100g: findNutrient(nutrients, 'Total lipid (fat)') ?? 0,
    fiberPer100g: findNutrient(nutrients, 'Fiber, total dietary') ?? null,
    sugarPer100g: findNutrient(nutrients, 'Sugars, total') ?? null,
    // USDA returns sodium in mg/100g — convert to g/100g
    sodiumPer100g: sodiumMg != null ? sodiumMg / 1000 : null,
  };
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function cacheGet<T>(redis: Redis, key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function cacheSet(redis: Redis, key: string, value: unknown): Promise<void> {
  try {
    await redis.setex(key, TTL.FOOD_API_RESPONSE, JSON.stringify(value));
  } catch {
    // Redis unavailable — silently skip caching
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getByBarcode(
  barcode: string,
  redisClient: Redis,
): Promise<FoodItemResult | null> {
  const cacheKey = `food:barcode:${barcode}`;

  const cached = await cacheGet<FoodItemResult | null>(redisClient, cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = (await res.json()) as OFFResponse;

    if (data.status !== 1 || !data.product) {
      await cacheSet(redisClient, cacheKey, null);
      return null;
    }

    const result = normalizeOFF(data.product, barcode);
    await cacheSet(redisClient, cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

export async function searchFood(query: string, redisClient: Redis): Promise<FoodItemResult[]> {
  // Use process.env directly so tests can override USDA_API_KEY at runtime
  const apiKey = process.env['USDA_API_KEY'] ?? env.USDA_API_KEY;
  if (!apiKey) return [];

  const cacheKey = `food:search:${query.toLowerCase()}`;

  const cached = await cacheGet<FoodItemResult[]>(redisClient, cacheKey);
  if (cached !== null) return cached;

  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as USDAResponse;

    const results = (data.foods ?? []).map(normalizeUSDA);
    await cacheSet(redisClient, cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

// ─── DB-backed food log functions ─────────────────────────────────────────────

export type FoodLogEntry = {
  id: string;
  foodLogId: string;
  foodItemId: string;
  mealType: string;
  quantityGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  loggedAt: Date;
  editedAt: Date | null;
};

export type DailyFoodLog = {
  id: string;
  userId: string;
  logDate: Date;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  entries: FoodLogEntry[];
};

/** Get or return null for a user's food log on a given date (YYYY-MM-DD). */
export async function getDailyFoodLog(
  userId: string,
  date: string,
  db: PrismaClient,
): Promise<DailyFoodLog | null> {
  const logDate = new Date(date);
  const log = await db.foodLog.findUnique({
    where: { userId_logDate: { userId, logDate } },
    include: { entries: true },
  });
  return log;
}

/**
 * Log a food entry.
 * Upserts the FoodItem by (source, sourceRefId), upserts the FoodLog day record,
 * creates the FoodLogEntry, and updates day totals.
 */
export async function logFoodEntry(
  userId: string,
  input: LogFoodEntryInput,
  db: PrismaClient,
): Promise<FoodLogEntry> {
  const logDate = new Date(input.date);

  // Derive a stable sourceRefId so USDA/OFF items are deduplicated
  const source = input.foodItem.source ?? 'custom';
  const sourceRefId =
    input.foodItem.sourceRefId ??
    `custom:${input.foodItem.name.toLowerCase().replace(/\s+/g, '_')}`;

  // Upsert the food item (no-op update so existing nutritional data is preserved)
  const foodItem = await db.foodItem.upsert({
    where: { source_sourceRefId: { source, sourceRefId } },
    create: {
      name: input.foodItem.name,
      brand: input.foodItem.brand ?? null,
      barcode: input.foodItem.barcode ?? null,
      source,
      sourceRefId,
      caloriesPer100g: Math.round(input.foodItem.caloriesPer100g),
      proteinPer100g: input.foodItem.proteinPer100g,
      carbsPer100g: input.foodItem.carbsPer100g,
      fatPer100g: input.foodItem.fatPer100g,
      fiberPer100g: input.foodItem.fiberPer100g ?? null,
    },
    update: {},
  });

  // Ensure the day log exists
  const dayLog = await db.foodLog.upsert({
    where: { userId_logDate: { userId, logDate } },
    create: {
      userId,
      logDate,
      totalCalories: 0,
      totalProteinG: 0,
      totalCarbsG: 0,
      totalFatG: 0,
      totalFiberG: 0,
    },
    update: {},
  });

  // Create the entry
  const entry = await db.foodLogEntry.create({
    data: {
      foodLogId: dayLog.id,
      foodItemId: foodItem.id,
      mealType: input.mealType,
      quantityGrams: input.quantityGrams,
      calories: input.calories,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      fiberG: input.fiberG ?? 0,
    },
  });

  // Update day totals
  await db.foodLog.update({
    where: { id: dayLog.id },
    data: {
      totalCalories: { increment: input.calories },
      totalProteinG: { increment: input.proteinG },
      totalCarbsG: { increment: input.carbsG },
      totalFatG: { increment: input.fatG },
      totalFiberG: { increment: input.fiberG ?? 0 },
    },
  });

  return entry;
}

/** Update quantity/meal type of an existing entry and recalculate day totals. */
export async function updateFoodEntry(
  userId: string,
  input: UpdateFoodEntryInput,
  db: PrismaClient,
): Promise<FoodLogEntry> {
  // Fetch entry + parent log to verify ownership
  const entry = await db.foodLogEntry.findUnique({
    where: { id: input.entryId },
    include: { foodLog: true, foodItem: true },
  });

  if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Food entry not found.' });
  if (entry.foodLog.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your food entry.' });
  }

  let newQuantityGrams = entry.quantityGrams;
  let newCalories = entry.calories;
  let newProteinG = entry.proteinG;
  let newCarbsG = entry.carbsG;
  let newFatG = entry.fatG;
  let newFiberG = entry.fiberG;

  // Recalculate macros if quantity changed
  if (input.quantityGrams !== undefined && input.quantityGrams !== entry.quantityGrams) {
    const ratio = input.quantityGrams / entry.quantityGrams;
    newQuantityGrams = input.quantityGrams;
    newCalories = Math.round(entry.calories * ratio);
    newProteinG = Math.round(entry.proteinG * ratio * 10) / 10;
    newCarbsG = Math.round(entry.carbsG * ratio * 10) / 10;
    newFatG = Math.round(entry.fatG * ratio * 10) / 10;
    newFiberG = Math.round(entry.fiberG * ratio * 10) / 10;
  }

  const updated = await db.foodLogEntry.update({
    where: { id: input.entryId },
    data: {
      quantityGrams: newQuantityGrams,
      mealType: input.mealType ?? entry.mealType,
      calories: newCalories,
      proteinG: newProteinG,
      carbsG: newCarbsG,
      fatG: newFatG,
      fiberG: newFiberG,
      editedAt: new Date(),
    },
  });

  // Recalculate day totals from scratch
  const allEntries = await db.foodLogEntry.findMany({ where: { foodLogId: entry.foodLogId } });
  const totals = allEntries.reduce(
    (acc, e) => ({
      totalCalories: acc.totalCalories + e.calories,
      totalProteinG: acc.totalProteinG + e.proteinG,
      totalCarbsG: acc.totalCarbsG + e.carbsG,
      totalFatG: acc.totalFatG + e.fatG,
      totalFiberG: acc.totalFiberG + e.fiberG,
    }),
    { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0, totalFiberG: 0 },
  );
  await db.foodLog.update({ where: { id: entry.foodLogId }, data: totals });

  return updated;
}

/** Delete an entry and recalculate day totals. */
export async function deleteFoodEntry(
  userId: string,
  entryId: string,
  db: PrismaClient,
): Promise<{ success: boolean }> {
  const entry = await db.foodLogEntry.findUnique({
    where: { id: entryId },
    include: { foodLog: true },
  });

  if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Food entry not found.' });
  if (entry.foodLog.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your food entry.' });
  }

  await db.foodLogEntry.delete({ where: { id: entryId } });

  // Recalculate day totals
  const remaining = await db.foodLogEntry.findMany({ where: { foodLogId: entry.foodLogId } });
  const totals = remaining.reduce(
    (acc, e) => ({
      totalCalories: acc.totalCalories + e.calories,
      totalProteinG: acc.totalProteinG + e.proteinG,
      totalCarbsG: acc.totalCarbsG + e.carbsG,
      totalFatG: acc.totalFatG + e.fatG,
      totalFiberG: acc.totalFiberG + e.fiberG,
    }),
    { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0, totalFiberG: 0 },
  );
  await db.foodLog.update({ where: { id: entry.foodLogId }, data: totals });

  return { success: true };
}
