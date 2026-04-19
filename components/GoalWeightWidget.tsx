import { Text, View } from 'react-native';

import { formatTargetDate, getGoalStatus, GOAL_STATUS_META } from '@/lib/goalCalculations';
import type { UnitSystem } from '@/lib/units';
import { displayWeight } from '@/lib/units';
import type { GoalMode } from '@/store/auth';

interface GoalWeightWidgetProps {
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  goalTargetDate: string | null;
  goalMode: GoalMode | null;
  unitSystem: UnitSystem;
}

export function GoalWeightWidget({
  currentWeightKg,
  goalWeightKg,
  goalTargetDate,
  goalMode,
  unitSystem,
}: GoalWeightWidgetProps) {
  if (!goalWeightKg) return null;

  const status = getGoalStatus(currentWeightKg, goalWeightKg, goalTargetDate, goalMode);
  const meta = GOAL_STATUS_META[status];

  const remainingKg = currentWeightKg != null ? Math.abs(currentWeightKg - goalWeightKg) : null;

  const goalDisplay = displayWeight(goalWeightKg, unitSystem);
  const remainingDisplay = remainingKg != null ? displayWeight(remainingKg, unitSystem) : null;
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  return (
    <View
      testID="goal-weight-widget"
      className="mb-4 rounded-2xl border border-surface-border bg-surface-card p-4"
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-zinc-400">Goal weight</Text>
        {meta && (
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 3,
              backgroundColor: meta.bg,
            }}
          >
            <Text style={{ color: meta.color, fontSize: 11, fontWeight: '600' }}>{meta.label}</Text>
          </View>
        )}
      </View>

      <Text className="text-2xl font-bold text-white">
        {goalDisplay}
        <Text className="text-base font-normal text-zinc-400"> {unitLabel}</Text>
      </Text>

      {goalTargetDate && (
        <Text className="mt-1 text-xs text-zinc-500">by {formatTargetDate(goalTargetDate)}</Text>
      )}

      {remainingDisplay != null && status !== 'reached' && status !== 'missed' && (
        <View className="mt-3 flex-row items-center gap-1.5">
          <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-border">
            {currentWeightKg != null &&
              (() => {
                const pct = Math.min(
                  Math.max(
                    goalMode === 'cut' || goalMode === 'maintenance'
                      ? 1 -
                          (currentWeightKg - goalWeightKg) /
                            Math.max(currentWeightKg - goalWeightKg + (remainingKg ?? 0), 0.01)
                      : (currentWeightKg - goalWeightKg + (remainingKg ?? 0)) /
                          Math.max(remainingKg ?? 1, 0.01),
                    0,
                  ),
                  1,
                );
                return (
                  <View
                    style={{ width: `${pct * 100}%`, backgroundColor: '#1a9e6e' }}
                    className="h-full rounded-full"
                  />
                );
              })()}
          </View>
          <Text className="text-xs text-zinc-500">
            {remainingDisplay} {unitLabel} remaining
          </Text>
        </View>
      )}

      {status === 'reached' && (
        <Text className="mt-2 text-xs text-brand-400">You've hit your goal! 🎉</Text>
      )}
      {status === 'missed' && (
        <Text className="mt-2 text-xs text-red-400">
          Target date passed — update your goal to keep going.
        </Text>
      )}
    </View>
  );
}
