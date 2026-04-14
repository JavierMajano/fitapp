import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <View className="flex-1 px-5 pt-4">
        <Text className="mb-1 text-2xl font-semibold text-white">Good morning 👋</Text>
        <Text className="text-sm text-zinc-400">Here's your summary for today</Text>

        {/* Macro ring placeholder */}
        <View className="mt-8 h-48 items-center justify-center rounded-3xl border border-surface-border bg-surface-card">
          <Text className="text-sm text-zinc-500">Macro ring coming soon</Text>
        </View>

        {/* Stats row placeholder */}
        <View className="mt-4 flex-row gap-3">
          {['Calories', 'Protein', 'Carbs', 'Fat'].map((label) => (
            <View
              key={label}
              className="flex-1 rounded-2xl border border-surface-border bg-surface-card p-3"
            >
              <Text className="mb-1 text-xs text-zinc-500">{label}</Text>
              <Text className="text-base font-semibold text-white">—</Text>
            </View>
          ))}
        </View>

        {/* Recent workout placeholder */}
        <View className="mt-4 rounded-2xl border border-surface-border bg-surface-card p-4">
          <Text className="mb-1 text-xs text-zinc-400">Last workout</Text>
          <Text className="text-sm text-zinc-500">No workouts logged yet</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
