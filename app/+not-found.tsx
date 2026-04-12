import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View className="bg-surface-DEFAULT flex-1 items-center justify-center">
        <Text className="text-lg text-white">This screen doesn't exist.</Text>
        <Link href="/" className="mt-4 text-brand-500">
          Go home
        </Link>
      </View>
    </>
  );
}
