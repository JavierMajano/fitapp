import type Redis from 'ioredis';

import { TTL } from '../redis';
import type { FoodItemResult } from '../schemas';

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
  const apiKey = process.env.USDA_API_KEY;
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
