import { Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { UnitSystem } from '@/lib/units';
import { useUnitsStore } from '@/store/units';

const OTHER_SETTINGS = ['Edit profile', 'Notifications', 'Connected apps'] as const;

export default function ProfileScreen() {
  const { unitSystem, setUnitSystem } = useUnitsStore();

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="mb-6 text-2xl font-semibold text-white">Profile</Text>

        {/* Avatar + name */}
        <View className="mb-8 items-center">
          <View className="mb-3 h-20 w-20 items-center justify-center rounded-full border-2 border-brand-400 bg-brand-400/20">
            <Text className="text-2xl font-semibold text-brand-400">U</Text>
          </View>
          <Text className="text-lg font-semibold text-white">Your Name</Text>
          <Text className="text-sm text-zinc-500">Set up your profile to get started</Text>
        </View>

        {/* Goal badge */}
        <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4">
          <Text className="text-sm text-zinc-400">Current goal</Text>
          <View className="rounded-full bg-amber-400/15 px-3 py-1">
            <Text className="text-sm font-medium text-amber-400">Not set</Text>
          </View>
        </View>

        {/* Stats */}
        <View className="mb-6 flex-row gap-3">
          {[
            { label: 'TDEE', val: '—' },
            { label: 'Target', val: '—' },
            { label: 'Weight', val: '—' },
          ].map((s) => (
            <View
              key={s.label}
              className="flex-1 rounded-2xl border border-surface-border bg-surface-card p-3"
            >
              <Text className="text-xs text-zinc-500">{s.label}</Text>
              <Text className="mt-1 text-base font-semibold text-white">{s.val}</Text>
            </View>
          ))}
        </View>

        {/* Settings rows */}
        <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
          Settings
        </Text>

        {/* Unit system segmented control */}
        <View className="mb-2 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card px-4 py-3.5">
          <Text className="text-sm font-medium text-white">Units</Text>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 10,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#2e2e2e',
            }}
          >
            {(['metric', 'imperial'] as UnitSystem[]).map((u) => (
              <TouchableOpacity
                key={u}
                testID={u === 'metric' ? 'unit-btn-kg' : 'unit-btn-lbs'}
                onPress={() => setUnitSystem(u)}
                style={{
                  backgroundColor: unitSystem === u ? '#1a9e6e' : '#222222',
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    color: unitSystem === u ? '#ffffff' : '#71717a',
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {u === 'metric' ? 'kg' : 'lbs'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Other settings */}
        {OTHER_SETTINGS.map((item) => (
          <TouchableOpacity
            key={item}
            className="mb-2 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card px-4 py-3.5"
          >
            <Text className="text-sm font-medium text-white">{item}</Text>
            <Text className="text-zinc-600">›</Text>
          </TouchableOpacity>
        ))}

        {/* Sign out */}
        <TouchableOpacity className="mb-2 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card px-4 py-3.5">
          <Text className="text-sm font-medium text-red-400">Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
