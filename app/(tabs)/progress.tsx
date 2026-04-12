import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProgressScreen() {
  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <View className="flex-1 px-5 pt-4">
        <Text className="mb-1 text-2xl font-semibold text-white">Progress</Text>
        <Text className="text-sm text-zinc-400">Charts coming in Phase 6</Text>

        {/* Weight chart placeholder */}
        <View className="mt-8 h-48 items-center justify-center rounded-3xl border border-surface-border bg-surface-card">
          <Text className="text-sm text-zinc-500">Body weight chart</Text>
        </View>

        {/* Calorie chart placeholder */}
        <View className="mt-4 h-48 items-center justify-center rounded-3xl border border-surface-border bg-surface-card">
          <Text className="text-sm text-zinc-500">Calorie chart</Text>
        </View>

        {/* Strength tracker placeholder */}
        <View className="mt-4 h-48 items-center justify-center rounded-3xl border border-surface-border bg-surface-card">
          <Text className="text-sm text-zinc-500">Strength tracker</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
