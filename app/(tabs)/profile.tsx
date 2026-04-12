import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View, TouchableOpacity, ScrollView } from "react-native";

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-DEFAULT">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-semibold text-white mb-6">Profile</Text>

        {/* Avatar + name */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-brand-400/20 border-2 border-brand-400 items-center justify-center mb-3">
            <Text className="text-brand-400 text-2xl font-semibold">U</Text>
          </View>
          <Text className="text-white font-semibold text-lg">Your Name</Text>
          <Text className="text-zinc-500 text-sm">Set up your profile to get started</Text>
        </View>

        {/* Goal badge */}
        <View className="bg-surface-card rounded-2xl border border-surface-border p-4 mb-4 flex-row justify-between items-center">
          <Text className="text-zinc-400 text-sm">Current goal</Text>
          <View className="bg-amber-400/15 px-3 py-1 rounded-full">
            <Text className="text-amber-400 text-sm font-medium">Not set</Text>
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3 mb-6">
          {[{ label: "TDEE", val: "—" }, { label: "Target", val: "—" }, { label: "Weight", val: "—" }].map((s) => (
            <View key={s.label} className="flex-1 bg-surface-card rounded-2xl border border-surface-border p-3">
              <Text className="text-zinc-500 text-xs">{s.label}</Text>
              <Text className="text-white font-semibold text-base mt-1">{s.val}</Text>
            </View>
          ))}
        </View>

        {/* Settings rows */}
        <Text className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">Settings</Text>
        {["Edit profile", "Units (kg / lbs)", "Notifications", "Connected apps", "Sign out"].map((item) => (
          <TouchableOpacity
            key={item}
            className="bg-surface-card rounded-2xl border border-surface-border px-4 py-3.5 mb-2 flex-row justify-between items-center"
          >
            <Text className={`text-sm font-medium ${item === "Sign out" ? "text-red-400" : "text-white"}`}>
              {item}
            </Text>
            {item !== "Sign out" && <Text className="text-zinc-600">›</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
