import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { trpc } from '@/lib/trpc';
import type { UnitSystem } from '@/lib/units';

import { WeightLineChart } from './WeightLineChart';

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All';

const RANGES: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'All'];

function rangeStartDate(range: TimeRange): string {
  const days: Record<TimeRange, number> = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    All: 730,
  };
  const d = new Date(Date.now() - days[range] * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ProgressChartModalProps {
  visible: boolean;
  onClose: () => void;
  goalWeightKg?: number | null;
  unitSystem: UnitSystem;
}

export function ProgressChartModal({
  visible,
  onClose,
  goalWeightKg,
  unitSystem,
}: ProgressChartModalProps) {
  const [range, setRange] = useState<TimeRange>('1M');
  const { width } = useWindowDimensions();
  const chartWidth = width - 40;
  const chartHeight = 220;

  const historyQuery = trpc.body.getHistory.useQuery(
    { startDate: rangeStartDate(range), endDate: todayKey() },
    { staleTime: 60_000, enabled: visible },
  );

  const data = (historyQuery.data ?? []).map((e) => ({
    date: new Date(e.loggedDate).toISOString().slice(0, 10),
    weightKg: e.weightKg,
  }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pb-4 pt-2">
          <Text className="text-lg font-semibold text-white">Weight history</Text>
          <TouchableOpacity
            testID="close-chart-modal-btn"
            onPress={onClose}
            className="rounded-lg bg-surface-border px-4 py-1.5"
          >
            <Text className="text-sm text-zinc-300">Close</Text>
          </TouchableOpacity>
        </View>

        {/* Time range toggle */}
        <View className="flex-row gap-1 px-5 pb-5">
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              testID={`chart-range-${r.toLowerCase()}`}
              onPress={() => setRange(r)}
              style={{ flex: 1 }}
              className={`items-center rounded-lg py-1.5 ${
                range === r ? 'bg-brand-400' : 'bg-surface-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${range === r ? 'text-white' : 'text-zinc-400'}`}
              >
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <View className="flex-1 items-center justify-center px-5">
          {historyQuery.isLoading ? (
            <ActivityIndicator color="#1a9e6e" size="large" />
          ) : (
            <WeightLineChart
              data={data}
              goalWeightKg={goalWeightKg}
              unitSystem={unitSystem}
              width={chartWidth}
              height={chartHeight}
              showLabels
            />
          )}
        </View>

        {/* Legend */}
        <View className="flex-row items-center gap-4 px-5 pb-6">
          <View className="flex-row items-center gap-2">
            <View className="h-0.5 w-6 bg-blue-500" />
            <Text className="text-xs text-zinc-500">Weight</Text>
          </View>
          {goalWeightKg != null && (
            <View className="flex-row items-center gap-2">
              <View className="h-px w-6 border-t border-dashed border-brand-400" />
              <Text className="text-xs text-zinc-500">Goal</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
