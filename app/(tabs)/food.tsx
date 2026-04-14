import { useState } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
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

export default function FoodScreen() {
  const [date, setDate] = useState(new Date());

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <View className="flex-1 px-5 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-white">Food log</Text>
          <TouchableOpacity className="rounded-xl bg-brand-400 px-4 py-2">
            <Text className="text-sm font-medium text-white">+ Add food</Text>
          </TouchableOpacity>
        </View>

        <DateNav
          date={date}
          onPrev={() => setDate(prevDay(date))}
          onNext={() => setDate(nextDay(date))}
        />

        {/* Calorie summary placeholder */}
        <View className="mb-4 rounded-3xl border border-surface-border bg-surface-card p-5">
          <Text className="mb-3 text-xs text-zinc-400">Daily target</Text>
          <View className="flex-row justify-between">
            {['Goal', 'Food', 'Exercise', 'Net'].map((label) => (
              <View key={label} className="items-center">
                <Text className="text-lg font-semibold text-white">—</Text>
                <Text className="mt-1 text-xs text-zinc-500">{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Meals placeholder */}
        {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((meal) => (
          <View
            key={meal}
            className="mb-3 rounded-2xl border border-surface-border bg-surface-card p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-medium text-white">{meal}</Text>
              <Text className="text-xs text-zinc-500">0 kcal</Text>
            </View>
            <Text className="mt-1 text-xs text-zinc-600">No entries yet</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
