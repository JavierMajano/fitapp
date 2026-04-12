import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";

export default function DashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-DEFAULT">
      <View className="flex-1 px-5 pt-4">
        <Text className="text-2xl font-semibold text-white mb-1">Good morning 👋</Text>
        <Text className="text-sm text-zinc-400">Here's your summary for today</Text>

        {/* Macro ring placeholder */}
        <View className="mt-8 items-center justify-center h-48 rounded-3xl bg-surface-card border border-surface-border">
          <Text className="text-zinc-500 text-sm">Macro ring coming soon</Text>
        </View>

        {/* Stats row placeholder */}
        <View className="flex-row gap-3 mt-4">
          {["Calories", "Protein", "Carbs", "Fat"].map((label) => (
            <View key={label} className="flex-1 bg-surface-card rounded-2xl p-3 border border-surface-border">
              <Text className="text-zinc-500 text-xs mb-1">{label}</Text>
              <Text className="text-white font-semibold text-base">—</Text>
            </View>
          ))}
        </View>

        {/* Recent workout placeholder */}
        <View className="mt-4 rounded-2xl bg-surface-card border border-surface-border p-4">
          <Text className="text-zinc-400 text-xs mb-1">Last workout</Text>
          <Text className="text-zinc-500 text-sm">No workouts logged yet</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
