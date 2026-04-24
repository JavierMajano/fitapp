import '../global.css';

import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ErrorToast } from '@components/ErrorToast';
import { trpc, trpcClient } from '@lib/trpc';
import { useAuthStore } from '@store/auth';
import { useToastStore } from '@store/toast';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  enabled: process.env.EXPO_PUBLIC_APP_ENV !== 'development',
  tracesSampleRate: 0.2,
});

function SentryFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0f0f0f',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text style={{ color: '#ef4444', fontSize: 20, fontWeight: '600', marginBottom: 12 }}>
        Something went wrong
      </Text>
      <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
        {error.message}
      </Text>
      <Pressable
        onPress={resetError}
        style={{
          backgroundColor: '#1a9e6e',
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

function isAuthError(error: unknown): boolean {
  const code = (error as { data?: { code?: string } })?.data?.code;
  return code === 'UNAUTHORIZED' || code === 'FORBIDDEN';
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (isAuthError(error)) return;
      Sentry.captureException(error, { extra: { queryKey: query.queryKey } });
      const msg =
        (error as { message?: string })?.message ?? 'Something went wrong. Please try again.';
      useToastStore.getState().showError(msg);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isAuthError(error)) return;
      Sentry.captureException(error);
      const msg =
        (error as { message?: string })?.message ?? 'Something went wrong. Please try again.';
      useToastStore.getState().showError(msg);
    },
  }),
});

function AuthGuard() {
  const { token, isLoading, isOnboarded } = useAuthStore();
  const segments = useSegments() as unknown as string[];

  useEffect(() => {
    // Wait until auth store has hydrated from storage
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[1] === 'onboarding';

    if (!token && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (token && !isOnboarded && !inOnboarding) {
      router.replace('/(auth)/onboarding');
    } else if (token && isOnboarded && inAuth) {
      router.replace('/(tabs)');
    }
  }, [token, isLoading, isOnboarded, segments]);

  return null;
}

export default Sentry.wrap(function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <SentryFallback error={error as Error} resetError={resetError} />
      )}
    >
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <ErrorToast />
        </QueryClientProvider>
      </trpc.Provider>
    </Sentry.ErrorBoundary>
  );
});
