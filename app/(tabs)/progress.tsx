import { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { displayWeight, toMetricWeight, WEIGHT_BOUNDS, type UnitSystem } from '@/lib/units';
import { useFitLog, caloriesForDate, type BodyWeightEntry } from '@/store/fitlog';
import { useUnitsStore } from '@/store/units';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
}

function kgToDisplay(kg: number, unit: UnitSystem): number {
  return unit === 'imperial' ? parseFloat((kg / 0.453592).toFixed(1)) : kg;
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

interface BarChartProps {
  bars: { label: string; value: number; maxValue: number; color: string }[];
  unit: string;
  height?: number;
}

function BarChart({ bars, unit, height = 120 }: BarChartProps) {
  const maxValue = Math.max(...bars.map((b) => b.maxValue), 1);

  return (
    <View style={{ height }} className="flex-row items-end justify-between px-1 pt-2">
      {bars.map((bar) => {
        const pct = Math.min(bar.value / maxValue, 1);
        const barH = Math.max(pct * (height - 32), bar.value > 0 ? 4 : 0);

        return (
          <View key={bar.label} className="flex-1 items-center">
            {bar.value > 0 && (
              <Text style={{ fontSize: 9, color: '#a1a1aa', marginBottom: 2 }} numberOfLines={1}>
                {bar.value % 1 === 0 ? bar.value : bar.value.toFixed(1)}
                {unit}
              </Text>
            )}
            <View
              style={{
                height: barH || 2,
                backgroundColor: bar.value > 0 ? bar.color : '#2e2e2e',
                borderRadius: 4,
                width: '70%',
              }}
            />
            <Text style={{ fontSize: 9, color: '#52525b', marginTop: 4 }}>{bar.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Log weight modal ─────────────────────────────────────────────────────────

interface LogWeightModalProps {
  visible: boolean;
  onClose: () => void;
  onLog: (date: string, weightKg: number) => void;
  unitSystem: UnitSystem;
}

function LogWeightModal({ visible, onClose, onLog, unitSystem }: LogWeightModalProps) {
  const [weight, setWeight] = useState('');
  const today = todayKey();
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';
  const maxVal = WEIGHT_BOUNDS[unitSystem].max;
  const minVal = unitSystem === 'imperial' ? 44 : 20;

  function handleLog() {
    const val = parseFloat(weight);
    if (!val || val < minVal || val > maxVal) return;
    const kg = toMetricWeight(String(val), unitSystem);
    onLog(today, kg);
    setWeight('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={onClose}>
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
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-white">Log Body Weight</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text className="text-zinc-400">✕</Text>
                </TouchableOpacity>
              </View>

              <Text className="mb-1 text-xs text-zinc-400">Today — {today}</Text>
              <Text className="mb-3 text-xs text-zinc-600">
                Enter your weight ({unitLabel}) for today
              </Text>

              <View className="mb-4 flex-row items-center gap-2">
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: '#222222',
                    color: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 24,
                    fontWeight: '600',
                    textAlign: 'center',
                  }}
                  placeholder="0.0"
                  placeholderTextColor="#52525b"
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={setWeight}
                  autoFocus
                />
                <Text className="text-2xl font-semibold text-zinc-400">{unitLabel}</Text>
              </View>

              <TouchableOpacity
                onPress={handleLog}
                className="items-center rounded-2xl bg-brand-400 py-4"
              >
                <Text className="text-base font-semibold text-white">Save Weight</Text>
              </TouchableOpacity>
              <View style={{ height: Platform.OS === 'ios' ? 20 : 0 }} />
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Weight entry row ─────────────────────────────────────────────────────────

function WeightRow({
  entry,
  onDelete,
  unitSystem,
}: {
  entry: BodyWeightEntry;
  onDelete: () => void;
  unitSystem: UnitSystem;
}) {
  return (
    <View className="flex-row items-center justify-between border-t border-surface-border py-3">
      <Text className="text-sm text-zinc-400">{entry.date}</Text>
      <Text className="text-base font-semibold text-white">
        {displayWeight(entry.weightKg, unitSystem)}
      </Text>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Text className="text-lg text-zinc-600">×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [weightModalVisible, setWeightModalVisible] = useState(false);

  const { foodEntries, bodyWeightEntries, addBodyWeight, removeBodyWeight, sessions } = useFitLog();
  const { unitSystem } = useUnitsStore();

  const days7 = lastNDays(7);

  // Weight chart — display values already converted to the active unit
  const weightBars = days7.map((d) => {
    const entry = bodyWeightEntries.find((e) => e.date === d);
    const allDisplay = bodyWeightEntries.map((e) => kgToDisplay(e.weightKg, unitSystem));
    const max = Math.max(...allDisplay, unitSystem === 'imperial' ? 220 : 100);
    const value = entry ? kgToDisplay(entry.weightKg, unitSystem) : 0;
    return { label: formatDate(d), value, maxValue: max, color: '#1a9e6e' };
  });

  // Calorie chart (unit-agnostic)
  const calorieBars = days7.map((d) => {
    const kcal = caloriesForDate(foodEntries, d);
    return { label: formatDate(d), value: kcal, maxValue: 3000, color: '#f97316' };
  });

  // Strength PRs from last 7 days
  const recentSets = sessions
    .filter((s) => days7.includes(s.date) && s.endedAt)
    .flatMap((s) => s.sets);

  const prMap: Record<string, { weightKg: number; reps: number }> = {};
  for (const set of recentSets) {
    const cur = prMap[set.exerciseName];
    if (!cur || set.weightKg > cur.weightKg) {
      prMap[set.exerciseName] = { weightKg: set.weightKg, reps: set.reps };
    }
  }
  const prs = Object.entries(prMap).slice(0, 5);

  // Weight trend
  const sorted = [...bodyWeightEntries].sort((a, b) => a.date.localeCompare(b.date));
  const latestKg = sorted[sorted.length - 1]?.weightKg;
  const prevKg = sorted[sorted.length - 2]?.weightKg;

  const latestDisplay = latestKg !== undefined ? displayWeight(latestKg, unitSystem) : null;
  const deltaKg = latestKg !== undefined && prevKg !== undefined ? latestKg - prevKg : null;
  const deltaDisplay =
    deltaKg !== null
      ? unitSystem === 'imperial'
        ? (deltaKg / 0.453592).toFixed(1)
        : deltaKg.toFixed(1)
      : null;

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-semibold text-white">Progress</Text>
            <Text className="text-sm text-zinc-400">Last 7 days</Text>
          </View>
          <TouchableOpacity
            onPress={() => setWeightModalVisible(true)}
            className="rounded-xl bg-brand-400 px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">Log weight</Text>
          </TouchableOpacity>
        </View>

        {/* Weight section */}
        <View className="mb-4 rounded-3xl border border-surface-border bg-surface-card p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-white">Body Weight</Text>
            {latestDisplay !== null && (
              <View className="flex-row items-baseline gap-2">
                <Text className="text-lg font-bold text-white">{latestDisplay}</Text>
                {deltaDisplay !== null && (
                  <Text
                    className={`text-xs font-medium ${parseFloat(deltaDisplay) < 0 ? 'text-brand-400' : parseFloat(deltaDisplay) > 0 ? 'text-red-400' : 'text-zinc-400'}`}
                  >
                    {parseFloat(deltaDisplay) > 0 ? '+' : ''}
                    {deltaDisplay}
                  </Text>
                )}
              </View>
            )}
          </View>
          <BarChart bars={weightBars} unit={unitSystem === 'metric' ? '' : ''} height={130} />
        </View>

        {/* Weight log list */}
        {bodyWeightEntries.length > 0 && (
          <View className="mb-4 rounded-2xl border border-surface-border bg-surface-card px-4 pb-1 pt-4">
            <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Weight log
            </Text>
            {[...bodyWeightEntries]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((entry) => (
                <WeightRow
                  key={entry.id}
                  entry={entry}
                  unitSystem={unitSystem}
                  onDelete={() => removeBodyWeight(entry.id)}
                />
              ))}
          </View>
        )}

        {/* Calorie section */}
        <View className="mb-4 rounded-3xl border border-surface-border bg-surface-card p-5">
          <Text className="mb-4 text-sm font-semibold text-white">Calorie Intake</Text>
          <BarChart bars={calorieBars} unit=" kcal" height={130} />
        </View>

        {/* Strength section */}
        <View className="mb-4 rounded-3xl border border-surface-border bg-surface-card p-5">
          <Text className="mb-3 text-sm font-semibold text-white">Strength PRs (7 days)</Text>
          {prs.length === 0 ? (
            <Text className="text-sm text-zinc-500">Complete a workout to see your PRs</Text>
          ) : (
            prs.map(([exercise, { weightKg, reps }]) => (
              <View
                key={exercise}
                className="flex-row items-center justify-between border-t border-surface-border py-3"
              >
                <Text className="flex-1 text-sm text-white" numberOfLines={1}>
                  {exercise}
                </Text>
                <Text className="text-sm font-semibold text-brand-400">
                  {displayWeight(weightKg, unitSystem)} × {reps}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Workout frequency */}
        <View className="mb-4 rounded-2xl border border-surface-border bg-surface-card p-4">
          <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Workout frequency (7 days)
          </Text>
          <View className="flex-row gap-2">
            {days7.map((d) => {
              const hasSession = sessions.some((s) => s.date === d && s.endedAt);
              return (
                <View key={d} className="flex-1 items-center">
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: hasSession ? '#1a9e6e' : '#2e2e2e',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {hasSession && <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 8, color: '#52525b', marginTop: 4 }}>
                    {formatDate(d)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <LogWeightModal
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        onLog={addBodyWeight}
        unitSystem={unitSystem}
      />
    </SafeAreaView>
  );
}
