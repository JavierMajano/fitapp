import { Text, TouchableOpacity, View } from 'react-native';

interface DateNavProps {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
}

function formatDate(date: Date): string {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function DateNav({ date, onPrev, onNext }: DateNavProps) {
  const atToday = isToday(date);

  return (
    <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card px-2 py-2">
      <TouchableOpacity testID="date-nav-prev" onPress={onPrev} className="px-3 py-1">
        <Text className="text-xl text-white">‹</Text>
      </TouchableOpacity>

      <Text testID="date-nav-label" className="text-sm font-medium text-white">
        {formatDate(date)}
      </Text>

      <TouchableOpacity
        testID="date-nav-next"
        onPress={onNext}
        disabled={atToday}
        className="px-3 py-1"
      >
        <Text className={`text-xl ${atToday ? 'text-zinc-700' : 'text-white'}`}>›</Text>
      </TouchableOpacity>
    </View>
  );
}
