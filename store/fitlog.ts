import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface FoodEntry {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantityG: number;
  mealType: MealType;
  date: string; // YYYY-MM-DD
}

export interface LoggedSet {
  id: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
}

export interface WorkoutSession {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  startedAt: number; // timestamp ms
  endedAt?: number;
  sets: LoggedSet[];
}

export interface BodyWeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
}

// ─── Mock seed data ───────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const TWO_AGO = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const THREE_AGO = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
const FOUR_AGO = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
const FIVE_AGO = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);

const SEED_FOOD: FoodEntry[] = [
  {
    id: 'se1',
    name: 'Oats',
    brand: 'Quaker',
    calories: 389,
    proteinG: 17,
    carbsG: 66,
    fatG: 7,
    quantityG: 100,
    mealType: 'breakfast',
    date: TODAY,
  },
  {
    id: 'se2',
    name: 'Greek Yogurt',
    brand: 'Chobani',
    calories: 100,
    proteinG: 10,
    carbsG: 6,
    fatG: 0,
    quantityG: 200,
    mealType: 'breakfast',
    date: TODAY,
  },
  {
    id: 'se3',
    name: 'Chicken Breast',
    brand: 'Generic',
    calories: 248,
    proteinG: 46,
    carbsG: 0,
    fatG: 5,
    quantityG: 150,
    mealType: 'lunch',
    date: TODAY,
  },
];

const SEED_SESSIONS: WorkoutSession[] = [
  {
    id: 'ws1',
    name: 'Push Day',
    date: YESTERDAY,
    startedAt: Date.now() - 90_000_000,
    endedAt: Date.now() - 86_700_000,
    sets: [
      { id: 's1', exerciseName: 'Bench Press', setNumber: 1, weightKg: 80, reps: 8 },
      { id: 's2', exerciseName: 'Bench Press', setNumber: 2, weightKg: 80, reps: 7 },
      { id: 's3', exerciseName: 'Overhead Press', setNumber: 1, weightKg: 50, reps: 10 },
      { id: 's4', exerciseName: 'Tricep Pushdown', setNumber: 1, weightKg: 30, reps: 12 },
    ],
  },
];

const SEED_WEIGHT: BodyWeightEntry[] = [
  { id: 'bw1', date: FIVE_AGO, weightKg: 82.5 },
  { id: 'bw2', date: FOUR_AGO, weightKg: 82.1 },
  { id: 'bw3', date: THREE_AGO, weightKg: 81.9 },
  { id: 'bw4', date: TWO_AGO, weightKg: 81.8 },
  { id: 'bw5', date: YESTERDAY, weightKg: 81.4 },
];

// ─── Store ────────────────────────────────────────────────────────────────────

interface FitLogState {
  // Food
  foodEntries: FoodEntry[];
  addFoodEntry: (entry: Omit<FoodEntry, 'id'>) => void;
  removeFoodEntry: (id: string) => void;

  // Workout
  sessions: WorkoutSession[];
  activeSessionId: string | null;
  startSession: (name: string) => string;
  addSet: (sessionId: string, set: Omit<LoggedSet, 'id'>) => void;
  endSession: (sessionId: string) => void;
  cancelSession: (sessionId: string) => void;

  // Progress
  bodyWeightEntries: BodyWeightEntry[];
  addBodyWeight: (date: string, weightKg: number) => void;
  removeBodyWeight: (id: string) => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const useFitLog = create<FitLogState>((set, get) => ({
  // ── Food ────────────────────────────────────────────────────────────────────
  foodEntries: SEED_FOOD,

  addFoodEntry: (entry) =>
    set((s) => ({ foodEntries: [...s.foodEntries, { ...entry, id: uid() }] })),

  removeFoodEntry: (id) => set((s) => ({ foodEntries: s.foodEntries.filter((e) => e.id !== id) })),

  // ── Workout ─────────────────────────────────────────────────────────────────
  sessions: SEED_SESSIONS,
  activeSessionId: null,

  startSession: (name) => {
    const id = uid();
    const today = new Date().toISOString().slice(0, 10);
    set((s) => ({
      sessions: [...s.sessions, { id, name, date: today, startedAt: Date.now(), sets: [] }],
      activeSessionId: id,
    }));
    return id;
  },

  addSet: (sessionId, setData) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, sets: [...sess.sets, { ...setData, id: uid() }] } : sess,
      ),
    })),

  endSession: (sessionId) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, endedAt: Date.now() } : sess,
      ),
      activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
    })),

  cancelSession: (sessionId) => {
    const { activeSessionId } = get();
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== sessionId),
      activeSessionId: activeSessionId === sessionId ? null : s.activeSessionId,
    }));
  },

  // ── Progress ─────────────────────────────────────────────────────────────────
  bodyWeightEntries: SEED_WEIGHT,

  addBodyWeight: (date, weightKg) =>
    set((s) => {
      const filtered = s.bodyWeightEntries.filter((e) => e.date !== date);
      return {
        bodyWeightEntries: [...filtered, { id: uid(), date, weightKg }].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      };
    }),

  removeBodyWeight: (id) =>
    set((s) => ({ bodyWeightEntries: s.bodyWeightEntries.filter((e) => e.id !== id) })),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export function foodEntriesForDate(entries: FoodEntry[], date: string): FoodEntry[] {
  return entries.filter((e) => e.date === date);
}

export function caloriesForDate(entries: FoodEntry[], date: string): number {
  return foodEntriesForDate(entries, date).reduce(
    (sum, e) => sum + Math.round((e.calories * e.quantityG) / 100),
    0,
  );
}

export function macrosForDate(
  entries: FoodEntry[],
  date: string,
): { protein: number; carbs: number; fat: number } {
  return foodEntriesForDate(entries, date).reduce(
    (acc, e) => ({
      protein: acc.protein + Math.round((e.proteinG * e.quantityG) / 100),
      carbs: acc.carbs + Math.round((e.carbsG * e.quantityG) / 100),
      fat: acc.fat + Math.round((e.fatG * e.quantityG) / 100),
    }),
    { protein: 0, carbs: 0, fat: 0 },
  );
}

// ─── Mock food database for search ───────────────────────────────────────────

export interface MockFoodItem {
  name: string;
  brand: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export const MOCK_FOOD_DB: MockFoodItem[] = [
  {
    name: 'Chicken Breast (cooked)',
    brand: 'Generic',
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
  },
  {
    name: 'Brown Rice (cooked)',
    brand: 'Generic',
    caloriesPer100g: 123,
    proteinPer100g: 2.7,
    carbsPer100g: 25.6,
    fatPer100g: 0.9,
  },
  {
    name: 'Whole Milk',
    brand: 'Generic',
    caloriesPer100g: 61,
    proteinPer100g: 3.2,
    carbsPer100g: 4.8,
    fatPer100g: 3.3,
  },
  {
    name: 'Banana',
    brand: 'Generic',
    caloriesPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 23,
    fatPer100g: 0.3,
  },
  {
    name: 'Greek Yogurt',
    brand: 'Chobani',
    caloriesPer100g: 100,
    proteinPer100g: 10,
    carbsPer100g: 6,
    fatPer100g: 0,
  },
  {
    name: 'Oats',
    brand: 'Quaker',
    caloriesPer100g: 389,
    proteinPer100g: 17,
    carbsPer100g: 66,
    fatPer100g: 7,
  },
  {
    name: 'Eggs (whole)',
    brand: 'Generic',
    caloriesPer100g: 155,
    proteinPer100g: 13,
    carbsPer100g: 1.1,
    fatPer100g: 11,
  },
  {
    name: 'Salmon (Atlantic)',
    brand: 'Generic',
    caloriesPer100g: 208,
    proteinPer100g: 20,
    carbsPer100g: 0,
    fatPer100g: 13,
  },
  {
    name: 'Sweet Potato',
    brand: 'Generic',
    caloriesPer100g: 86,
    proteinPer100g: 1.6,
    carbsPer100g: 20,
    fatPer100g: 0.1,
  },
  {
    name: 'Almonds',
    brand: 'Generic',
    caloriesPer100g: 579,
    proteinPer100g: 21,
    carbsPer100g: 22,
    fatPer100g: 50,
  },
  {
    name: 'Broccoli',
    brand: 'Generic',
    caloriesPer100g: 34,
    proteinPer100g: 2.8,
    carbsPer100g: 7,
    fatPer100g: 0.4,
  },
  {
    name: 'White Rice (cooked)',
    brand: 'Generic',
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28,
    fatPer100g: 0.3,
  },
  {
    name: 'Ground Beef (80/20)',
    brand: 'Generic',
    caloriesPer100g: 254,
    proteinPer100g: 17,
    carbsPer100g: 0,
    fatPer100g: 20,
  },
  {
    name: 'Whey Protein',
    brand: 'Optimum Nutrition',
    caloriesPer100g: 408,
    proteinPer100g: 78,
    carbsPer100g: 8,
    fatPer100g: 6,
  },
  {
    name: 'Avocado',
    brand: 'Generic',
    caloriesPer100g: 160,
    proteinPer100g: 2,
    carbsPer100g: 9,
    fatPer100g: 15,
  },
  {
    name: 'Pasta (cooked)',
    brand: 'Generic',
    caloriesPer100g: 131,
    proteinPer100g: 5,
    carbsPer100g: 25,
    fatPer100g: 1.1,
  },
  {
    name: 'Cottage Cheese',
    brand: 'Generic',
    caloriesPer100g: 98,
    proteinPer100g: 11,
    carbsPer100g: 3.4,
    fatPer100g: 4.3,
  },
  {
    name: 'Peanut Butter',
    brand: 'Jif',
    caloriesPer100g: 588,
    proteinPer100g: 25,
    carbsPer100g: 20,
    fatPer100g: 50,
  },
  {
    name: 'Apple',
    brand: 'Generic',
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 14,
    fatPer100g: 0.2,
  },
  {
    name: 'Tuna (canned)',
    brand: 'Bumble Bee',
    caloriesPer100g: 116,
    proteinPer100g: 26,
    carbsPer100g: 0,
    fatPer100g: 1,
  },
  {
    name: 'Whole Wheat Bread',
    brand: "Nature's Own",
    caloriesPer100g: 247,
    proteinPer100g: 9,
    carbsPer100g: 47,
    fatPer100g: 3,
  },
  {
    name: 'Orange Juice',
    brand: 'Tropicana',
    caloriesPer100g: 45,
    proteinPer100g: 0.7,
    carbsPer100g: 10,
    fatPer100g: 0.2,
  },
  {
    name: 'Steak (sirloin)',
    brand: 'Generic',
    caloriesPer100g: 207,
    proteinPer100g: 26,
    carbsPer100g: 0,
    fatPer100g: 11,
  },
  {
    name: 'Lentils (cooked)',
    brand: 'Generic',
    caloriesPer100g: 116,
    proteinPer100g: 9,
    carbsPer100g: 20,
    fatPer100g: 0.4,
  },
  {
    name: 'Spinach',
    brand: 'Generic',
    caloriesPer100g: 23,
    proteinPer100g: 2.9,
    carbsPer100g: 3.6,
    fatPer100g: 0.4,
  },
];

export const MOCK_EXERCISES: string[] = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Pull-up',
  'Dips',
  'Incline Bench Press',
  'Romanian Deadlift',
  'Leg Press',
  'Dumbbell Curl',
  'Tricep Pushdown',
  'Lat Pulldown',
  'Cable Row',
  'Hip Thrust',
  'Leg Curl',
  'Leg Extension',
  'Calf Raise',
  'Face Pull',
  'Lateral Raise',
  'Chest Fly',
  'Hammer Curl',
  'Skull Crusher',
  'Bulgarian Split Squat',
  'Plank',
];
