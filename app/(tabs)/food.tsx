import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View, TouchableOpacity } from "react-native";

export default function FoodScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-DEFAULT">
      <View className="flex-1 px-5 pt-4">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-semibold text-white">Food log</Text>
          <TouchableOpacity className="bg-brand-400 px-4 py-2 rounded-xl">
            <Text className="text-white text-sm font-medium">+ Add food</Text>
          </TouchableOpacity>
        </View>

        {/* Calorie summary placeholder */}
        <View className="bg-surface-card rounded-3xl border border-surface-border p-5 mb-4">
          <Text className="text-zinc-400 text-xs mb-3">Daily target</Text>
          <View className="flex-row justify-between">
            {["Goal", "Food", "Exercise", "Net"].map((label) => (
              <View key={label} className="items-center">
                <Text className="text-white font-semibold text-lg">—</Text>
                <Text className="text-zinc-500 text-xs mt-1">{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Meals placeholder */}
        {["Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => (
          <View key={meal} className="bg-surface-card rounded-2xl border border-surface-border p-4 mb-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-white font-medium">{meal}</Text>
              <Text className="text-zinc-500 text-xs">0 kcal</Text>
            </View>
            <Text className="text-zinc-600 text-xs mt-1">No entries yet</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
