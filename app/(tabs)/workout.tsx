import { useState } from 'react';
import { Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateNav } from '@/components/DateNav';

function prevDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
}

function nextDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

const DEFAULT_ROUTINES = [
  { name: 'Push / Pull / Legs', days: '6-day split', tag: 'bulk' },
  { name: 'Upper / Lower', days: '4-day split', tag: 'maint' },
  { name: 'Full Body', days: '3-day split', tag: 'cut' },
];

export default function WorkoutScreen() {
  const [date, setDate] = useState(new Date());

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-white">Workout</Text>
          <TouchableOpacity className="rounded-xl bg-brand-400 px-4 py-2">
            <Text className="text-sm font-medium text-white">Start session</Text>
          </TouchableOpacity>
        </View>

        <DateNav
          date={date}
          onPrev={() => setDate(prevDay(date))}
          onNext={() => setDate(nextDay(date))}
        />

        {/* Quick start */}
        <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
          My routines
        </Text>
        <View className="mb-6 items-center rounded-2xl border border-surface-border bg-surface-card p-4">
          <Text className="text-sm text-zinc-500">No routines yet — create one below</Text>
        </View>

        {/* Default routines */}
        <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
          Starter routines
        </Text>
        {DEFAULT_ROUTINES.map((r) => (
          <TouchableOpacity
            key={r.name}
            className="mb-3 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4"
          >
            <View>
              <Text className="font-medium text-white">{r.name}</Text>
              <Text className="mt-0.5 text-xs text-zinc-500">{r.days}</Text>
            </View>
            <View
              className={`rounded-full px-3 py-1 ${r.tag === 'bulk' ? 'bg-amber-400/15' : r.tag === 'cut' ? 'bg-red-400/15' : 'bg-blue-400/15'}`}
            >
              <Text
                className={`text-xs font-medium ${r.tag === 'bulk' ? 'text-amber-400' : r.tag === 'cut' ? 'text-red-400' : 'text-blue-400'}`}
              >
                {r.tag}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
