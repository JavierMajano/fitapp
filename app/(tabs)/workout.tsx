import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View, TouchableOpacity, ScrollView } from "react-native";

const DEFAULT_ROUTINES = [
  { name: "Push / Pull / Legs", days: "6-day split", tag: "bulk" },
  { name: "Upper / Lower",      days: "4-day split", tag: "maint" },
  { name: "Full Body",          days: "3-day split", tag: "cut" },
];

export default function WorkoutScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-DEFAULT">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-semibold text-white">Workout</Text>
          <TouchableOpacity className="bg-brand-400 px-4 py-2 rounded-xl">
            <Text className="text-white text-sm font-medium">Start session</Text>
          </TouchableOpacity>
        </View>

        {/* Quick start */}
        <Text className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">My routines</Text>
        <View className="bg-surface-card rounded-2xl border border-surface-border p-4 mb-6 items-center">
          <Text className="text-zinc-500 text-sm">No routines yet — create one below</Text>
        </View>

        {/* Default routines */}
        <Text className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">Starter routines</Text>
        {DEFAULT_ROUTINES.map((r) => (
          <TouchableOpacity
            key={r.name}
            className="bg-surface-card rounded-2xl border border-surface-border p-4 mb-3 flex-row items-center justify-between"
          >
            <View>
              <Text className="text-white font-medium">{r.name}</Text>
              <Text className="text-zinc-500 text-xs mt-0.5">{r.days}</Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${r.tag === "bulk" ? "bg-amber-400/15" : r.tag === "cut" ? "bg-red-400/15" : "bg-blue-400/15"}`}>
              <Text className={`text-xs font-medium ${r.tag === "bulk" ? "text-amber-400" : r.tag === "cut" ? "text-red-400" : "text-blue-400"}`}>
                {r.tag}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
