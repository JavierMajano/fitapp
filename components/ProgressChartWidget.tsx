import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { trpc } from '@/lib/trpc';
import type { UnitSystem } from '@/lib/units';

import { ProgressChartModal } from './ProgressChartModal';
import { WeightLineChart } from './WeightLineChart';

function nDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ProgressChartWidgetProps {
  goalWeightKg?: number | null;
  unitSystem: UnitSystem;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 110;

export function ProgressChartWidget({ goalWeightKg, unitSystem }: ProgressChartWidgetProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const historyQuery = trpc.body.getHistory.useQuery(
    { startDate: nDaysAgo(7), endDate: todayKey() },
    { staleTime: 300_000 },
  );

  const data = (historyQuery.data ?? []).map((e) => ({
    date: new Date(e.loggedDate).toISOString().slice(0, 10),
    weightKg: e.weightKg,
  }));

  return (
    <>
      <View
        testID="progress-chart-widget"
        className="mb-4 rounded-2xl border border-surface-border bg-surface-card p-4"
      >
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-medium text-zinc-400">Weight progress</Text>
          <TouchableOpacity
            testID="expand-chart-btn"
            onPress={() => setModalVisible(true)}
            className="rounded-lg bg-surface-border px-3 py-1"
          >
            <Text className="text-xs font-medium text-zinc-300">Expand</Text>
          </TouchableOpacity>
        </View>

        {historyQuery.isLoading ? (
          <View style={{ height: CHART_HEIGHT }} className="items-center justify-center">
            <Text className="text-xs text-zinc-600">Loading…</Text>
          </View>
        ) : (
          <WeightLineChart
            data={data}
            goalWeightKg={goalWeightKg}
            unitSystem={unitSystem}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            showLabels
          />
        )}

        {goalWeightKg != null && (
          <View className="mt-2 flex-row items-center gap-2">
            <View className="h-px w-6 border-t border-dashed border-brand-400" />
            <Text className="text-xs text-zinc-600">Goal</Text>
          </View>
        )}
      </View>

      <ProgressChartModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        goalWeightKg={goalWeightKg}
        unitSystem={unitSystem}
      />
    </>
  );
}
