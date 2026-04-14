import '../global.css';

import { GluestackUIProvider } from '@gluestack-ui/themed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { gluestackConfig } from '@/config/gluestack';
import { trpc, trpcClient } from '@/lib/trpc';
import { useAuthStore } from '@/store/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

function AuthGuard() {
  const { token, isLoading, isOnboarded } = useAuthStore();
  const segments = useSegments();
  const navState = useRootNavigationState();

  useEffect(() => {
    // Wait until navigation is ready and auth has hydrated
    if (!navState?.key || isLoading) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[1] === 'onboarding';

    if (!token && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (token && !isOnboarded && !inOnboarding) {
      router.replace('/(auth)/onboarding');
    } else if (token && isOnboarded && inAuth) {
      router.replace('/(tabs)');
    }
  }, [token, isLoading, isOnboarded, segments, navState?.key]);

  return null;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GluestackUIProvider config={gluestackConfig} colorMode="dark">
          <StatusBar style="light" />
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </GluestackUIProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
