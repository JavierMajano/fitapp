import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as foodService from '../../services/food.service';

// ─── Redis mock ───────────────────────────────────────────────────────────────

function makeMockRedis(cached: unknown = null) {
  return {
    get: vi.fn().mockResolvedValue(cached !== null ? JSON.stringify(cached) : null),
    setex: vi.fn().mockResolvedValue('OK'),
  };
}

// ─── fetch mock helpers ───────────────────────────────────────────────────────

function mockFetch(data: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  } as Response);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OFF_BARCODE = '0123456789012';

const OFF_PRODUCT_RESPONSE = {
  status: 1,
  product: {
    product_name: 'Oat Milk',
    brands: 'Oatly',
    code: OFF_BARCODE,
    nutriments: {
      'energy-kcal_100g': 47,
      proteins_100g: 1,
      carbohydrates_100g: 6.5,
      fat_100g: 1.5,
      fiber_100g: 0.8,
      sugars_100g: 4,
      sodium_100g: 0.1,
    },
  },
};

const USDA_SEARCH_RESPONSE = {
  foods: [
    {
      fdcId: 123456,
      description: 'Chicken Breast, raw',
      brandOwner: 'USDA',
      foodNutrients: [
        { nutrientName: 'Energy', unitName: 'kcal', value: 120 },
        { nutrientName: 'Protein', unitName: 'g', value: 22.5 },
        { nutrientName: 'Carbohydrate, by difference', unitName: 'g', value: 0 },
        { nutrientName: 'Total lipid (fat)', unitName: 'g', value: 2.6 },
        { nutrientName: 'Fiber, total dietary', unitName: 'g', value: 0 },
        { nutrientName: 'Sugars, total', unitName: 'g', value: 0 },
        { nutrientName: 'Sodium, Na', unitName: 'mg', value: 74 },
      ],
    },
  ],
};

// ─── getByBarcode ─────────────────────────────────────────────────────────────

describe('foodService.getByBarcode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a FoodItemResult with correct fields when OFF returns a product', async () => {
    const redis = makeMockRedis(null);
    mockFetch(OFF_PRODUCT_RESPONSE);

    const result = await foodService.getByBarcode(OFF_BARCODE, redis as never);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      name: 'Oat Milk',
      brand: 'Oatly',
      barcode: OFF_BARCODE,
      source: 'open_food_facts',
      sourceRefId: OFF_BARCODE,
      caloriesPer100g: 47,
      proteinPer100g: 1,
      carbsPer100g: 6.5,
      fatPer100g: 1.5,
      fiberPer100g: 0.8,
      sugarPer100g: 4,
      sodiumPer100g: 0.1,
    });
  });

  it('returns null when OFF responds with status !== 1 (product not found)', async () => {
    const redis = makeMockRedis(null);
    mockFetch({ status: 0 });

    const result = await foodService.getByBarcode('0000000000000', redis as never);

    expect(result).toBeNull();
  });

  it('returns cached value and does not call fetch when cache has a hit', async () => {
    const cachedProduct = {
      name: 'Cached Item',
      brand: null,
      barcode: OFF_BARCODE,
      source: 'open_food_facts',
      sourceRefId: OFF_BARCODE,
      caloriesPer100g: 200,
      proteinPer100g: 10,
      carbsPer100g: 20,
      fatPer100g: 5,
      fiberPer100g: null,
      sugarPer100g: null,
      sodiumPer100g: null,
    };
    const redis = makeMockRedis(cachedProduct);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const result = await foodService.getByBarcode(OFF_BARCODE, redis as never);

    expect(result).toMatchObject(cachedProduct);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stores result in Redis after a successful OFF fetch', async () => {
    const redis = makeMockRedis(null);
    mockFetch(OFF_PRODUCT_RESPONSE);

    await foodService.getByBarcode(OFF_BARCODE, redis as never);

    expect(redis.setex).toHaveBeenCalledOnce();
    const [key, , payload] = redis.setex.mock.calls[0] as [string, number, string];
    expect(key).toBe(`food:barcode:${OFF_BARCODE}`);
    const stored = JSON.parse(payload) as { name: string };
    expect(stored).toMatchObject({ name: 'Oat Milk' });
  });

  it('returns null and does not throw when fetch rejects (network error)', async () => {
    const redis = makeMockRedis(null);
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const result = await foodService.getByBarcode(OFF_BARCODE, redis as never);

    expect(result).toBeNull();
  });
});

// ─── searchFood ───────────────────────────────────────────────────────────────

describe('foodService.searchFood', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.USDA_API_KEY = 'test-usda-key';
  });

  afterEach(() => {
    delete process.env.USDA_API_KEY;
    vi.restoreAllMocks();
  });

  it('returns empty array when USDA_API_KEY is not set', async () => {
    delete process.env.USDA_API_KEY;
    const redis = makeMockRedis(null);

    const result = await foodService.searchFood('chicken', redis as never);

    expect(result).toEqual([]);
  });

  it('maps USDA foods to FoodItemResult with correct fields including sodium conversion', async () => {
    const redis = makeMockRedis(null);
    mockFetch(USDA_SEARCH_RESPONSE);

    const results = await foodService.searchFood('chicken', redis as never);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: 'Chicken Breast, raw',
      brand: 'USDA',
      barcode: null,
      source: 'usda',
      sourceRefId: '123456',
      caloriesPer100g: 120,
      proteinPer100g: 22.5,
      carbsPer100g: 0,
      fatPer100g: 2.6,
    });
    // USDA returns sodium in mg/100g; service must convert to g/100g
    expect(results[0]?.sodiumPer100g).toBeCloseTo(0.074);
  });

  it('returns cached results and skips fetch on cache hit', async () => {
    const cachedResults = [
      {
        name: 'Banana',
        brand: null,
        barcode: null,
        source: 'usda',
        sourceRefId: '999',
        caloriesPer100g: 89,
        proteinPer100g: 1.1,
        carbsPer100g: 23,
        fatPer100g: 0.3,
        fiberPer100g: 2.6,
        sugarPer100g: 12,
        sodiumPer100g: 0.001,
      },
    ];
    const redis = makeMockRedis(cachedResults);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const results = await foodService.searchFood('banana', redis as never);

    expect(results).toMatchObject(cachedResults);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns empty array and does not throw when fetch rejects (network error)', async () => {
    const redis = makeMockRedis(null);
    global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

    const results = await foodService.searchFood('apple', redis as never);

    expect(results).toEqual([]);
  });
});
