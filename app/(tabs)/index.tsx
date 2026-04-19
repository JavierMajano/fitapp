import { Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { trpc } from '@/lib/trpc';

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Macro ring (progress arc via simple bar) ─────────────────────────────────

function MacroBar({
  label,
  value,
  goal,
  color,
  unit,
}: {
  label: string;
  value: number;
  goal: number | null;
  color: string;
  unit: string;
}) {
  const pct = goal && goal > 0 ? Math.min((value / goal) * 100, 100) : 0;

  return (
    <View className="flex-1">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs text-zinc-400">{label}</Text>
        <Text className="text-xs font-medium text-white">
          {value}
          {unit}
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-surface-border">
        <View
          style={{ width: `${pct}%`, backgroundColor: color }}
          className="h-full rounded-full"
        />
      </View>
      {goal !== null && (
        <Text className="mt-0.5 text-right text-xs text-zinc-600">
          of {goal}
          {unit}
        </Text>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const today = toDateKey(new Date());

  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: 300_000 });
  const logQuery = trpc.food.getDailyLog.useQuery({ date: today }, { staleTime: 30_000 });

  const user = meQuery.data;
  const log = logQuery.data;

  const totalKcal = log?.totalCalories ?? 0;
  const proteinG = Math.round(log?.totalProteinG ?? 0);
  const carbsG = Math.round(log?.totalCarbsG ?? 0);
  const fatG = Math.round(log?.totalFatG ?? 0);

  const calorieTarget = user?.calorieTarget ?? null;
  const ringPct =
    calorieTarget && calorieTarget > 0 ? Math.min((totalKcal / calorieTarget) * 100, 100) : 0;

  const isLoading = meQuery.isLoading || logQuery.isLoading;

  // Goal weight progress
  const showGoalWidget = user?.goalWeightKg != null && user?.weightKg != null;
  const goalProgressPct =
    showGoalWidget && user.goalWeightKg != null && user.weightKg != null
      ? (() => {
          const start = user.weightKg;
          const goal = user.goalWeightKg;
          if (start === goal) return 100;
          // For cut: progress = (start - current) / (start - goal)
          // For bulk: progress = (current - start) / (goal - start)
          const isCut = goal < start;
          const current = user.weightKg;
          const pct = isCut
            ? Math.min(((start - current) / (start - goal)) * 100, 100)
            : Math.min(((current - start) / (goal - start)) * 100, 100);
          return Math.max(pct, 0);
        })()
      : 0;

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <View className="flex-1 px-5 pt-4">
        {/* Header */}
        <Text testID="dashboard-greeting" className="mb-1 text-2xl font-semibold text-white">
          {greeting()}
          {user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
        </Text>
        <Text className="mb-6 text-sm text-zinc-400">Here's your summary for today</Text>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1a9e6e" size="large" />
          </View>
        ) : (
          <>
            {/* Calorie ring card */}
            <View className="mb-4 rounded-3xl border border-surface-border bg-surface-card p-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-white">Calories</Text>
                {calorieTarget !== null && (
                  <Text className="text-xs text-zinc-400">
                    {totalKcal} / {calorieTarget} kcal
                  </Text>
                )}
              </View>

              {/* Progress arc (simplified as bar) */}
              <View
                testID="calorie-progress-bar"
                className="mb-4 h-3 overflow-hidden rounded-full bg-surface-border"
              >
                <View
                  style={{ width: `${ringPct}%` }}
                  className="h-full rounded-full bg-brand-400"
                />
              </View>

              {calorieTarget === null && (
                <Text className="mb-3 text-xs text-zinc-500">
                  Complete onboarding to set your calorie target
                </Text>
              )}

              {/* Macro bars */}
              <View className="gap-3">
                <MacroBar
                  label="Protein"
                  value={proteinG}
                  goal={user?.proteinTargetG ?? null}
                  color="#a855f7"
                  unit="g"
                />
                <MacroBar
                  label="Carbs"
                  value={carbsG}
                  goal={user?.carbsTargetG ?? null}
                  color="#f97316"
                  unit="g"
                />
                <MacroBar
                  label="Fat"
                  value={fatG}
                  goal={user?.fatTargetG ?? null}
                  color="#eab308"
                  unit="g"
                />
              </View>
            </View>

            {/* Stats row */}
            <View className="mb-4 flex-row gap-3">
              {[
                { label: 'Calories', value: totalKcal > 0 ? String(totalKcal) : '—', unit: 'kcal' },
                { label: 'Protein', value: proteinG > 0 ? String(proteinG) : '—', unit: 'g' },
                { label: 'Carbs', value: carbsG > 0 ? String(carbsG) : '—', unit: 'g' },
                { label: 'Fat', value: fatG > 0 ? String(fatG) : '—', unit: 'g' },
              ].map((s) => (
                <View
                  key={s.label}
                  className="flex-1 rounded-2xl border border-surface-border bg-surface-card p-3"
                >
                  <Text className="mb-1 text-xs text-zinc-500">{s.label}</Text>
                  <Text className="text-base font-semibold text-white">{s.value}</Text>
                  {s.value !== '—' && <Text className="text-xs text-zinc-600">{s.unit}</Text>}
                </View>
              ))}
            </View>

            {/* Goal weight widget */}
            {showGoalWidget && (
              <View
                testID="goal-weight-widget"
                className="mb-4 rounded-2xl border border-surface-border bg-surface-card p-4"
              >
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Goal weight
                  </Text>
                  <Text className="text-xs text-zinc-500">
                    {user.weightKg}kg → {user.goalWeightKg}kg
                  </Text>
                </View>
                <View
                  testID="goal-weight-progress-bar"
                  className="h-2 overflow-hidden rounded-full bg-surface-border"
                >
                  <View
                    style={{ width: `${goalProgressPct}%` }}
                    className="h-full rounded-full bg-brand-400"
                  />
                </View>
                <Text className="mt-1 text-right text-xs text-zinc-500">
                  {Math.round(goalProgressPct)}% complete
                </Text>
              </View>
            )}

            {/* Last workout placeholder */}
            <View className="rounded-2xl border border-surface-border bg-surface-card p-4">
              <Text className="mb-1 text-xs text-zinc-400">Last workout</Text>
              <Text className="text-sm text-zinc-500">Check the Workout tab</Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
