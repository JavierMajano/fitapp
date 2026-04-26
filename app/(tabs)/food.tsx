import { useState, useCallback, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeScanner } from '@/components/BarcodeScanner';
import { DateNav } from '@/components/DateNav';
import { trpc } from '@/lib/trpc';
import type { MealType } from '@/store/fitlog';
import { useToastStore } from '@/store/toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface FoodItemResult {
  name: string;
  brand: string | null;
  barcode: string | null;
  source: string;
  sourceRefId: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
}

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

// ─── Entry row ────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantityGrams: number;
  foodItem?: { name: string; brand?: string | null } | null;
}

function EntryRow({ entry, onDelete }: { entry: LogEntry; onDelete: () => void }) {
  return (
    <View className="mt-2 flex-row items-center justify-between border-t border-surface-border pt-2">
      <View className="flex-1 pr-2">
        <Text className="text-sm text-white" numberOfLines={1}>
          {entry.foodItem?.name ?? 'Unknown food'}
        </Text>
        <Text className="text-xs text-zinc-500">
          {entry.quantityGrams}g · {entry.calories} kcal
        </Text>
      </View>
      <TouchableOpacity testID={`delete-entry-${entry.id}`} onPress={onDelete} hitSlop={8}>
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
  onLogged: () => void;
}

function AddFoodModal({ visible, onClose, defaultMeal, date, onLogged }: AddFoodModalProps) {
  const [step, setStep] = useState<ModalStep>('search');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItemResult | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [showScanner, setShowScanner] = useState(false);
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const showError = useToastStore((s) => s.showError);

  // Debounce query
  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    const t = setTimeout(() => setDebouncedQuery(text), 400);
    return () => clearTimeout(t);
  }, []);

  const searchQuery = trpc.food.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 0, staleTime: 60_000 },
  );

  const barcodeQuery2 = trpc.food.byBarcode.useQuery(
    { barcode: barcodeQuery },
    { enabled: barcodeQuery.length > 0, staleTime: 300_000 },
  );

  // React Query v5 removed onSuccess callbacks — use effect instead
  useEffect(() => {
    if (!barcodeQuery2.isFetched || barcodeQuery2.isFetching || barcodeQuery.length === 0) return;
    if (barcodeQuery2.data) {
      selectFood(barcodeQuery2.data as FoodItemResult);
    } else {
      showError('Food not found — try searching by name');
    }
    setBarcodeQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeQuery2.isFetched, barcodeQuery2.isFetching]);

  const logEntry = trpc.food.logEntry.useMutation({
    onSuccess: () => {
      onLogged();
      handleClose();
    },
    onError: (err) => showError(err.message),
  });

  function reset() {
    setStep('search');
    setQuery('');
    setDebouncedQuery('');
    setSelectedFood(null);
    setQuantity('100');
    setMeal(defaultMeal);
    setBarcodeQuery('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectFood(food: FoodItemResult) {
    setSelectedFood(food);
    setStep('quantity');
  }

  function handleLog() {
    if (!selectedFood) return;
    const qty = parseFloat(quantity) || 100;
    const ratio = qty / 100;
    logEntry.mutate({
      foodItem: {
        name: selectedFood.name,
        brand: selectedFood.brand,
        barcode: selectedFood.barcode,
        source: selectedFood.source,
        sourceRefId: selectedFood.sourceRefId,
        caloriesPer100g: selectedFood.caloriesPer100g,
        proteinPer100g: selectedFood.proteinPer100g,
        carbsPer100g: selectedFood.carbsPer100g,
        fatPer100g: selectedFood.fatPer100g,
        fiberPer100g: selectedFood.fiberPer100g,
      },
      mealType: meal,
      quantityGrams: qty,
      calories: Math.round(selectedFood.caloriesPer100g * ratio),
      proteinG: Math.round(selectedFood.proteinPer100g * ratio * 10) / 10,
      carbsG: Math.round(selectedFood.carbsPer100g * ratio * 10) / 10,
      fatG: Math.round(selectedFood.fatPer100g * ratio * 10) / 10,
      fiberG:
        selectedFood.fiberPer100g != null
          ? Math.round(selectedFood.fiberPer100g * ratio * 10) / 10
          : undefined,
      date,
    });
  }

  const qty = parseFloat(quantity) || 0;
  const previewKcal = selectedFood ? Math.round((selectedFood.caloriesPer100g * qty) / 100) : 0;
  const previewProt = selectedFood
    ? Math.round(((selectedFood.proteinPer100g * qty) / 100) * 10) / 10
    : 0;

  const results: FoodItemResult[] = (searchQuery.data as FoodItemResult[] | undefined) ?? [];

  if (showScanner) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <BarcodeScanner
          onScan={(barcode) => {
            setShowScanner(false);
            setBarcodeQuery(barcode);
          }}
          onClose={() => setShowScanner(false)}
        />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={handleClose}>
        <Pressable onPress={() => {}} style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
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
                  <TouchableOpacity
                    testID="food-quantity-back-btn"
                    onPress={() => setStep('search')}
                  >
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
                  {/* Search row */}
                  <View className="mb-3 flex-row gap-2">
                    <TextInput
                      testID="food-search-input"
                      className="flex-1 rounded-xl px-4 py-3 text-white"
                      style={{ backgroundColor: '#222222', color: '#fff' }}
                      placeholder="Search foods…"
                      placeholderTextColor="#52525b"
                      value={query}
                      onChangeText={handleQueryChange}
                      autoFocus
                    />
                    <TouchableOpacity
                      testID="barcode-scanner-btn"
                      onPress={() => setShowScanner(true)}
                      className="items-center justify-center rounded-xl bg-surface-border px-3"
                    >
                      <Text className="text-lg">📷</Text>
                    </TouchableOpacity>
                  </View>

                  {barcodeQuery.length > 0 && barcodeQuery2.isLoading && (
                    <View className="mb-3 flex-row items-center gap-2">
                      <ActivityIndicator size="small" color="#1a9e6e" />
                      <Text className="text-sm text-zinc-400">Looking up barcode…</Text>
                    </View>
                  )}

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
                  {searchQuery.isFetching && debouncedQuery.length > 0 ? (
                    <View className="items-center py-8">
                      <ActivityIndicator color="#1a9e6e" />
                    </View>
                  ) : (
                    <FlatList
                      data={results}
                      keyExtractor={(item) => `${item.source}:${item.sourceRefId}`}
                      style={{ maxHeight: 300 }}
                      showsVerticalScrollIndicator={false}
                      ListEmptyComponent={
                        debouncedQuery.length > 0 ? (
                          <Text className="py-4 text-center text-sm text-zinc-500">
                            No results found
                          </Text>
                        ) : (
                          <Text className="py-4 text-center text-sm text-zinc-500">
                            Type to search USDA food database
                          </Text>
                        )
                      }
                      renderItem={({ item, index }) => (
                        <TouchableOpacity
                          testID={`food-result-${index}`}
                          onPress={() => selectFood(item)}
                          className="border-b border-surface-border py-3"
                        >
                          <Text className="text-sm font-medium text-white">{item.name}</Text>
                          <Text className="text-xs text-zinc-500">
                            {item.brand ? `${item.brand} · ` : ''}
                            {item.caloriesPer100g} kcal/100g · {item.proteinPer100g}g protein
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </>
              ) : (
                selectedFood && (
                  <>
                    {/* Food info */}
                    <View className="mb-4 rounded-2xl border border-surface-border bg-surface-input p-4">
                      <Text className="text-base font-semibold text-white">
                        {selectedFood.name}
                      </Text>
                      {selectedFood.brand && (
                        <Text className="mt-0.5 text-xs text-zinc-500">{selectedFood.brand}</Text>
                      )}
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
                            {Math.round(((selectedFood.carbsPer100g * qty) / 100) * 10) / 10}g
                          </Text>
                          <Text className="text-xs text-zinc-500">carbs</Text>
                        </View>
                        <View className="items-center">
                          <Text className="text-sm font-bold text-yellow-400">
                            {Math.round(((selectedFood.fatPer100g * qty) / 100) * 10) / 10}g
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
                      disabled={logEntry.isPending}
                      className="items-center rounded-2xl bg-brand-400 py-4"
                    >
                      {logEntry.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-base font-semibold text-white">
                          Log {previewKcal} kcal
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                )
              )}
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
  entries: LogEntry[];
  onAdd: (mealType: MealType) => void;
  onDelete: (id: string) => void;
}) {
  const totalKcal = entries.reduce((sum, e) => sum + e.calories, 0);

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
  const showError = useToastStore((s) => s.showError);

  const dateKey = toDateKey(date);
  const utils = trpc.useUtils();

  const logQuery = trpc.food.getDailyLog.useQuery({ date: dateKey }, { staleTime: 30_000 });

  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: 300_000 });

  const deleteEntry = trpc.food.deleteEntry.useMutation({
    onSuccess: () => utils.food.getDailyLog.invalidate({ date: dateKey }),
    onError: (err) => showError(err.message),
  });

  const log = logQuery.data;
  const calorieGoal = meQuery.data?.calorieTarget ?? 2400;
  const totalKcal = log?.totalCalories ?? 0;
  const protein = Math.round(log?.totalProteinG ?? 0);
  const carbs = Math.round(log?.totalCarbsG ?? 0);
  const fat = Math.round(log?.totalFatG ?? 0);
  const ringPct = Math.min((totalKcal / calorieGoal) * 100, 100);

  // Group entries by meal type — include foodItem if available via include
  const entries: LogEntry[] = (log?.entries as LogEntry[] | undefined) ?? [];

  function openAddModal(mealType: MealType) {
    setModalMeal(mealType);
    setModalVisible(true);
  }

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-white">Food log</Text>
          <TouchableOpacity
            testID="add-food-btn"
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
              {totalKcal} / {calorieGoal} kcal
            </Text>
          </View>

          {/* Progress bar */}
          <View
            testID="calorie-progress-bar"
            className="mb-4 h-2 overflow-hidden rounded-full bg-surface-border"
          >
            <View className="h-full rounded-full bg-brand-400" style={{ width: `${ringPct}%` }} />
          </View>

          {logQuery.isFetching ? (
            <View className="items-center py-2">
              <ActivityIndicator size="small" color="#1a9e6e" />
            </View>
          ) : (
            <View className="flex-row justify-between">
              <MacroPill label="Goal" value={calorieGoal} unit=" kcal" color="#1a9e6e" />
              <MacroPill label="Food" value={totalKcal} unit=" kcal" color="#fff" />
              <MacroPill label="Protein" value={protein} unit="g" color="#a855f7" />
              <MacroPill label="Carbs" value={carbs} unit="g" color="#f97316" />
              <MacroPill label="Fat" value={fat} unit="g" color="#eab308" />
            </View>
          )}
        </View>

        {/* Meal cards */}
        {MEALS.map((meal) => (
          <MealCard
            key={meal.key}
            meal={meal}
            entries={entries.filter((e) => e.mealType === meal.key)}
            onAdd={openAddModal}
            onDelete={(id) => deleteEntry.mutate({ entryId: id })}
          />
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      <AddFoodModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        defaultMeal={modalMeal}
        date={dateKey}
        onLogged={() => utils.food.getDailyLog.invalidate({ date: dateKey })}
      />
    </SafeAreaView>
  );
}
