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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { trpc } from '@/lib/trpc';
import { displayWeight, toMetricWeight, WEIGHT_BOUNDS, type UnitSystem } from '@/lib/units';
import { useToastStore } from '@/store/toast';
import { useUnitsStore } from '@/store/units';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m ?? '0', 10)}/${parseInt(d ?? '0', 10)}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
}

// ─── Time range selector ──────────────────────────────────────────────────────

type TimeRange = '1W' | '1M' | '3M';

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  const OPTIONS: TimeRange[] = ['1W', '1M', '3M'];
  return (
    <View className="flex-row gap-1">
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt}
          testID={`time-range-${opt.toLowerCase()}`}
          onPress={() => onChange(opt)}
          className={`rounded-lg px-3 py-1 ${value === opt ? 'bg-brand-400' : 'bg-surface-border'}`}
        >
          <Text className={`text-xs font-medium ${value === opt ? 'text-white' : 'text-zinc-400'}`}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function rangeStartDate(range: TimeRange): string {
  switch (range) {
    case '1W':
      return nDaysAgo(7);
    case '1M':
      return nDaysAgo(30);
    case '3M':
      return nDaysAgo(90);
  }
}

// ─── Bar chart (custom SVG-free) ──────────────────────────────────────────────

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
  isPending: boolean;
}

function LogWeightModal({ visible, onClose, onLog, unitSystem, isPending }: LogWeightModalProps) {
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
                  testID="weight-log-input"
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
                testID="save-weight-btn"
                onPress={handleLog}
                disabled={isPending}
                className="items-center rounded-2xl bg-brand-400 py-4"
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-base font-semibold text-white">Save Weight</Text>
                )}
              </TouchableOpacity>
              <View style={{ height: Platform.OS === 'ios' ? 20 : 0 }} />
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightRange, setWeightRange] = useState<TimeRange>('1W');
  const [calorieRange, setCalorieRange] = useState<TimeRange>('1W');

  const { unitSystem } = useUnitsStore();
  const showError = useToastStore((s) => s.showError);
  const utils = trpc.useUtils();

  const today = todayKey();

  const weightHistoryQuery = trpc.body.getHistory.useQuery(
    { startDate: rangeStartDate(weightRange), endDate: today },
    { staleTime: 60_000 },
  );

  const calorieHistoryQuery = trpc.progress.getCalorieHistory.useQuery(
    { startDate: rangeStartDate(calorieRange), endDate: today },
    { staleTime: 60_000 },
  );

  const logWeightMut = trpc.body.logWeight.useMutation({
    onSuccess: () => {
      setWeightModalVisible(false);
      utils.body.getHistory.invalidate();
    },
    onError: (err) => showError(err.message),
  });

  // ── Weight chart data ──
  const weightEntries = weightHistoryQuery.data ?? [];
  const days7 = lastNDays(weightRange === '1W' ? 7 : weightRange === '1M' ? 30 : 90);

  const weightBars = (() => {
    if (weightRange === '1W') {
      return days7.map((d) => {
        const entry = weightEntries.find((e) => {
          const entryDate = new Date(e.loggedDate).toISOString().slice(0, 10);
          return entryDate === d;
        });
        const allDisplay = weightEntries.map((e) =>
          unitSystem === 'imperial' ? e.weightKg / 0.453592 : e.weightKg,
        );
        const max = Math.max(...allDisplay, unitSystem === 'imperial' ? 220 : 100);
        const value = entry
          ? unitSystem === 'imperial'
            ? parseFloat((entry.weightKg / 0.453592).toFixed(1))
            : entry.weightKg
          : 0;
        return { label: formatDate(d), value, maxValue: max, color: '#1a9e6e' };
      });
    }
    // For wider ranges, just show data points
    return weightEntries.slice(-14).map((e) => {
      const val =
        unitSystem === 'imperial' ? parseFloat((e.weightKg / 0.453592).toFixed(1)) : e.weightKg;
      return {
        label: formatDate(new Date(e.loggedDate).toISOString().slice(0, 10)),
        value: val,
        maxValue: val * 1.2,
        color: '#1a9e6e',
      };
    });
  })();

  // ── Calorie chart data ──
  const calPoints = calorieHistoryQuery.data ?? [];
  const calorieBars = (() => {
    if (weightRange === '1W') {
      return lastNDays(7).map((d) => {
        const point = calPoints.find((p) => p.date === d);
        return {
          label: formatDate(d),
          value: point?.totalCalories ?? 0,
          maxValue: Math.max(...calPoints.map((p) => p.totalCalories), 3000),
          color: '#f97316',
        };
      });
    }
    return calPoints.slice(-14).map((p) => ({
      label: formatDate(p.date),
      value: p.totalCalories,
      maxValue: Math.max(...calPoints.map((pp) => pp.totalCalories), 3000),
      color: '#f97316',
    }));
  })();

  // ── Weight trend ──
  const sorted = [...weightEntries].sort(
    (a, b) => new Date(a.loggedDate).getTime() - new Date(b.loggedDate).getTime(),
  );
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
          </View>
          <TouchableOpacity
            testID="log-weight-btn"
            onPress={() => setWeightModalVisible(true)}
            className="rounded-xl bg-brand-400 px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">Log weight</Text>
          </TouchableOpacity>
        </View>

        {/* Weight section */}
        <View
          testID="weight-chart"
          className="mb-4 rounded-3xl border border-surface-border bg-surface-card p-5"
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-white">Body Weight</Text>
            <TimeRangeSelector value={weightRange} onChange={setWeightRange} />
          </View>
          {latestDisplay !== null && (
            <View className="mb-2 flex-row items-baseline gap-2">
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
          {weightHistoryQuery.isFetching ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#1a9e6e" />
            </View>
          ) : weightBars.length > 0 ? (
            <BarChart bars={weightBars} unit="" height={130} />
          ) : (
            <Text className="py-4 text-center text-sm text-zinc-500">No weight data yet</Text>
          )}
        </View>

        {/* Calorie section */}
        <View
          testID="calorie-chart"
          className="mb-4 rounded-3xl border border-surface-border bg-surface-card p-5"
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-white">Calorie Intake</Text>
            <TimeRangeSelector value={calorieRange} onChange={setCalorieRange} />
          </View>
          {calorieHistoryQuery.isFetching ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#f97316" />
            </View>
          ) : calorieBars.length > 0 ? (
            <BarChart bars={calorieBars} unit=" kcal" height={130} />
          ) : (
            <Text className="py-4 text-center text-sm text-zinc-500">No calorie data yet</Text>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <LogWeightModal
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        onLog={(date, weightKg) => logWeightMut.mutate({ date, weightKg })}
        unitSystem={unitSystem}
        isPending={logWeightMut.isPending}
      />
    </SafeAreaView>
  );
}
