import { useState, useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateNav } from '@/components/DateNav';
import {
  useFitLog,
  foodEntriesForDate,
  caloriesForDate,
  macrosForDate,
  MOCK_FOOD_DB,
  type MockFoodItem,
  type MealType,
  type FoodEntry,
} from '@/store/fitlog';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function prevDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
}

function nextDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

const CALORIE_GOAL = 2400;

// ─── Macro pill ───────────────────────────────────────────────────────────────

function MacroPill({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <View className="items-center">
      <Text style={{ color }} className="text-base font-bold">
        {value}
        <Text className="text-xs font-normal text-zinc-400">{unit}</Text>
      </Text>
      <Text className="mt-0.5 text-xs text-zinc-500">{label}</Text>
    </View>
  );
}

// ─── Entry row inside a meal card ────────────────────────────────────────────

function EntryRow({ entry, onDelete }: { entry: FoodEntry; onDelete: () => void }) {
  const kcal = Math.round((entry.calories * entry.quantityG) / 100);
  return (
    <View className="mt-2 flex-row items-center justify-between border-t border-surface-border pt-2">
      <View className="flex-1 pr-2">
        <Text className="text-sm text-white" numberOfLines={1}>
          {entry.name}
        </Text>
        <Text className="text-xs text-zinc-500">
          {entry.quantityG}g · {kcal} kcal
        </Text>
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Text className="text-lg text-zinc-600">×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Food Modal ───────────────────────────────────────────────────────────

type ModalStep = 'search' | 'quantity';

interface AddFoodModalProps {
  visible: boolean;
  onClose: () => void;
  defaultMeal: MealType;
  date: string;
}

function AddFoodModal({ visible, onClose, defaultMeal, date }: AddFoodModalProps) {
  const addFoodEntry = useFitLog((s) => s.addFoodEntry);

  const [step, setStep] = useState<ModalStep>('search');
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<MockFoodItem | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [meal, setMeal] = useState<MealType>(defaultMeal);

  const results = useMemo(() => {
    if (!query.trim()) return MOCK_FOOD_DB.slice(0, 10);
    const q = query.toLowerCase();
    return MOCK_FOOD_DB.filter(
      (f) => f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q),
    ).slice(0, 12);
  }, [query]);

  function reset() {
    setStep('search');
    setQuery('');
    setSelectedFood(null);
    setQuantity('100');
    setMeal(defaultMeal);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectFood(food: MockFoodItem) {
    setSelectedFood(food);
    setStep('quantity');
  }

  function handleLog() {
    if (!selectedFood) return;
    const qty = parseFloat(quantity) || 100;
    addFoodEntry({
      name: selectedFood.name,
      brand: selectedFood.brand,
      calories: selectedFood.caloriesPer100g,
      proteinG: selectedFood.proteinPer100g,
      carbsG: selectedFood.carbsPer100g,
      fatG: selectedFood.fatPer100g,
      quantityG: qty,
      mealType: meal,
      date,
    });
    handleClose();
  }

  const qty = parseFloat(quantity) || 0;
  const previewKcal = selectedFood ? Math.round((selectedFood.caloriesPer100g * qty) / 100) : 0;
  const previewProt = selectedFood ? Math.round((selectedFood.proteinPer100g * qty) / 100) : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={handleClose}>
        <Pressable onPress={() => {}} style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View
              style={{
                backgroundColor: '#1a1a1a',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
              className="p-5"
            >
              {/* Header */}
              <View className="mb-4 flex-row items-center justify-between">
                {step === 'quantity' ? (
                  <TouchableOpacity onPress={() => setStep('search')}>
                    <Text className="text-sm font-medium text-brand-400">‹ Back</Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-lg font-semibold text-white">Add Food</Text>
                )}
                <TouchableOpacity onPress={handleClose}>
                  <Text className="text-zinc-400">✕</Text>
                </TouchableOpacity>
              </View>

              {step === 'search' ? (
                <>
                  {/* Search input */}
                  <TextInput
                    className="mb-3 rounded-xl bg-surface-input px-4 py-3 text-white"
                    style={{ backgroundColor: '#222222', color: '#fff' }}
                    placeholder="Search foods…"
                    placeholderTextColor="#52525b"
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                  />

                  {/* Meal selector */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                    <View className="flex-row gap-2">
                      {MEALS.map((m) => (
                        <TouchableOpacity
                          key={m.key}
                          onPress={() => setMeal(m.key)}
                          className={`rounded-full px-4 py-1.5 ${meal === m.key ? 'bg-brand-400' : 'bg-surface-border'}`}
                        >
                          <Text
                            className={`text-sm font-medium ${meal === m.key ? 'text-white' : 'text-zinc-400'}`}
                          >
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Results */}
                  <FlatList
                    data={results}
                    keyExtractor={(item) => item.name}
                    style={{ maxHeight: 320 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => selectFood(item)}
                        className="border-b border-surface-border py-3"
                      >
                        <Text className="text-sm font-medium text-white">{item.name}</Text>
                        <Text className="text-xs text-zinc-500">
                          {item.brand} · {item.caloriesPer100g} kcal/100g · {item.proteinPer100g}g
                          protein
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              ) : (
                selectedFood && (
                  <>
                    {/* Food info */}
                    <View className="mb-4 rounded-2xl border border-surface-border bg-surface-input p-4">
                      <Text className="text-base font-semibold text-white">
                        {selectedFood.name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-zinc-500">{selectedFood.brand}</Text>
                      <View className="mt-3 flex-row justify-between">
                        <View className="items-center">
                          <Text className="text-sm font-bold text-white">{previewKcal}</Text>
                          <Text className="text-xs text-zinc-500">kcal</Text>
                        </View>
                        <View className="items-center">
                          <Text className="text-sm font-bold text-purple-400">{previewProt}g</Text>
                          <Text className="text-xs text-zinc-500">protein</Text>
                        </View>
                        <View className="items-center">
                          <Text className="text-sm font-bold text-orange-400">
                            {Math.round((selectedFood.carbsPer100g * qty) / 100)}g
                          </Text>
                          <Text className="text-xs text-zinc-500">carbs</Text>
                        </View>
                        <View className="items-center">
                          <Text className="text-sm font-bold text-yellow-400">
                            {Math.round((selectedFood.fatPer100g * qty) / 100)}g
                          </Text>
                          <Text className="text-xs text-zinc-500">fat</Text>
                        </View>
                      </View>
                    </View>

                    {/* Quantity */}
                    <Text className="mb-2 text-xs text-zinc-400">Quantity (grams)</Text>
                    <TextInput
                      className="mb-4 rounded-xl px-4 py-3 text-white"
                      style={{ backgroundColor: '#222222', color: '#fff' }}
                      keyboardType="numeric"
                      value={quantity}
                      onChangeText={setQuantity}
                      selectTextOnFocus
                    />

                    {/* Meal selector */}
                    <Text className="mb-2 text-xs text-zinc-400">Meal</Text>
                    <View className="mb-5 flex-row gap-2">
                      {MEALS.map((m) => (
                        <TouchableOpacity
                          key={m.key}
                          testID={`meal-btn-${m.key}`}
                          onPress={() => setMeal(m.key)}
                          className={`flex-1 items-center rounded-xl py-2 ${meal === m.key ? 'bg-brand-400' : 'bg-surface-border'}`}
                        >
                          <Text
                            className={`text-xs font-medium ${meal === m.key ? 'text-white' : 'text-zinc-400'}`}
                          >
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      testID="log-food-btn"
                      onPress={handleLog}
                      className="items-center rounded-2xl bg-brand-400 py-4"
                    >
                      <Text className="text-base font-semibold text-white">
                        Log {previewKcal} kcal
                      </Text>
                    </TouchableOpacity>
                  </>
                )
              )}
              {/* Safe area bottom pad */}
              <View style={{ height: Platform.OS === 'ios' ? 20 : 0 }} />
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Meal Card ────────────────────────────────────────────────────────────────

function MealCard({
  meal,
  entries,
  onAdd,
  onDelete,
}: {
  meal: { key: MealType; label: string };
  entries: FoodEntry[];
  onAdd: (mealType: MealType) => void;
  onDelete: (id: string) => void;
}) {
  const totalKcal = entries.reduce(
    (sum, e) => sum + Math.round((e.calories * e.quantityG) / 100),
    0,
  );

  return (
    <View className="mb-3 rounded-2xl border border-surface-border bg-surface-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-white">{meal.label}</Text>
        <View className="flex-row items-center gap-3">
          <Text className="text-xs text-zinc-500">{totalKcal} kcal</Text>
          <TouchableOpacity
            onPress={() => onAdd(meal.key)}
            className="rounded-lg bg-brand-400/15 px-2.5 py-1"
          >
            <Text className="text-xs font-semibold text-brand-400">+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {entries.length === 0 ? (
        <Text className="mt-2 text-xs text-zinc-600">No entries yet</Text>
      ) : (
        entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} onDelete={() => onDelete(entry.id)} />
        ))
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FoodScreen() {
  const [date, setDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMeal, setModalMeal] = useState<MealType>('breakfast');

  const foodEntries = useFitLog((s) => s.foodEntries);
  const removeFoodEntry = useFitLog((s) => s.removeFoodEntry);

  const dateKey = toDateKey(date);
  const dayEntries = foodEntriesForDate(foodEntries, dateKey);
  const totalKcal = caloriesForDate(foodEntries, dateKey);
  const macros = macrosForDate(foodEntries, dateKey);

  function openAddModal(meal: MealType) {
    setModalMeal(meal);
    setModalVisible(true);
  }

  const ringPct = Math.min((totalKcal / CALORIE_GOAL) * 100, 100);

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-white">Food log</Text>
          <TouchableOpacity
            onPress={() => openAddModal('breakfast')}
            className="rounded-xl bg-brand-400 px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">+ Add food</Text>
          </TouchableOpacity>
        </View>

        <DateNav
          date={date}
          onPrev={() => setDate(prevDay(date))}
          onNext={() => setDate(nextDay(date))}
        />

        {/* Calorie summary */}
        <View className="mb-4 rounded-3xl border border-surface-border bg-surface-card p-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs text-zinc-400">Daily target</Text>
            <Text className="text-xs text-zinc-500">
              {totalKcal} / {CALORIE_GOAL} kcal
            </Text>
          </View>

          {/* Progress bar */}
          <View className="mb-4 h-2 overflow-hidden rounded-full bg-surface-border">
            <View className="h-full rounded-full bg-brand-400" style={{ width: `${ringPct}%` }} />
          </View>

          <View className="flex-row justify-between">
            <MacroPill label="Goal" value={CALORIE_GOAL} unit=" kcal" color="#1a9e6e" />
            <MacroPill label="Food" value={totalKcal} unit=" kcal" color="#fff" />
            <MacroPill label="Protein" value={macros.protein} unit="g" color="#a855f7" />
            <MacroPill label="Carbs" value={macros.carbs} unit="g" color="#f97316" />
            <MacroPill label="Fat" value={macros.fat} unit="g" color="#eab308" />
          </View>
        </View>

        {/* Meal cards */}
        {MEALS.map((meal) => (
          <MealCard
            key={meal.key}
            meal={meal}
            entries={dayEntries.filter((e) => e.mealType === meal.key)}
            onAdd={openAddModal}
            onDelete={removeFoodEntry}
          />
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      <AddFoodModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        defaultMeal={modalMeal}
        date={dateKey}
      />
    </SafeAreaView>
  );
}
