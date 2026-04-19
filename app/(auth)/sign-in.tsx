import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { trpc } from '@/lib/trpc';
import { useAuthStore } from '@/store/auth';
import type { GoalMode, User } from '@/store/auth';

WebBrowser.maybeCompleteAuthSession();

function toStoreUser(user: {
  id: string;
  email: string;
  name: string;
  goalMode: string | null;
  tdeeCalories: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
}): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    goalMode: (user.goalMode as GoalMode | null) ?? null,
    tdeeCalories: user.tdeeCalories,
    calorieTarget: user.calorieTarget,
    proteinTargetG: user.proteinTargetG,
    carbsTargetG: user.carbsTargetG,
    fatTargetG: user.fatTargetG,
  };
}

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);

  // ── Email/password ──────────────────────────────────────────────────────────
  const signIn = trpc.auth.signIn.useMutation({
    onSuccess: async ({ token, user }) => {
      await setAuth(toStoreUser(user), token);
    },
    onError: (e) => setError(e.message),
  });

  const handleSignIn = () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    signIn.mutate({ email: email.trim().toLowerCase(), password });
  };

  // ── Google SSO ──────────────────────────────────────────────────────────────
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleConfigured = !!googleWebClientId;

  // Fallback prevents expo-auth-session from throwing an invariant when env
  // vars are not set (e.g. local dev without credentials configured).
  const [_request, googleResponse, promptGoogle] = Google.useAuthRequest({
    webClientId: googleWebClientId ?? 'UNCONFIGURED',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  const googleSignIn = trpc.auth.googleSignIn.useMutation({
    onSuccess: async ({ token, user }) => {
      await setAuth(toStoreUser(user), token);
    },
    onError: (e) => setError(e.message),
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.authentication?.idToken;
      if (idToken) {
        setError('');
        googleSignIn.mutate({ idToken });
      } else {
        setError('Google sign-in did not return a token.');
      }
    }
  }, [googleResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Brand */}
          <View className="mb-10 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-brand-400">
              <Text className="text-3xl font-bold text-white">F</Text>
            </View>
            <Text className="text-3xl font-bold text-white">FitApp</Text>
            <Text className="mt-1 text-sm text-zinc-400">Track. Train. Transform.</Text>
          </View>

          {/* Error banner */}
          {error ? (
            <View
              testID="signin-error"
              className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
            >
              <Text className="text-sm text-red-400">{error}</Text>
            </View>
          ) : null}

          {/* Google button */}
          <TouchableOpacity
            className="mb-3 flex-row items-center justify-center rounded-xl bg-white py-3.5"
            onPress={() => {
              setError('');
              if (!googleConfigured) {
                setError('Google sign-in is not configured.');
                return;
              }
              promptGoogle();
            }}
            disabled={googleSignIn.isPending || signIn.isPending}
          >
            {googleSignIn.isPending ? (
              <ActivityIndicator color="#111" />
            ) : (
              <>
                <Text className="mr-2 text-base font-bold text-zinc-800">G</Text>
                <Text className="text-base font-semibold text-zinc-800">Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View className="my-5 flex-row items-center">
            <View className="h-px flex-1 bg-surface-border" />
            <Text className="mx-4 text-sm text-zinc-500">or</Text>
            <View className="h-px flex-1 bg-surface-border" />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="mb-2 text-sm text-zinc-400">Email</Text>
            <TextInput
              testID="signin-email-input"
              className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5 text-base text-white"
              placeholder="you@example.com"
              placeholderTextColor="#52525b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleSignIn}
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="mb-2 text-sm text-zinc-400">Password</Text>
            <TextInput
              testID="signin-password-input"
              className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5 text-base text-white"
              placeholder="••••••••"
              placeholderTextColor="#52525b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSignIn}
              returnKeyType="done"
            />
          </View>

          {/* Sign in button */}
          <TouchableOpacity
            testID="signin-btn"
            className={`items-center rounded-xl py-4 ${signIn.isPending ? 'bg-brand-400/60' : 'bg-brand-400'}`}
            onPress={handleSignIn}
            disabled={signIn.isPending || googleSignIn.isPending}
          >
            {signIn.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Sign up link */}
          <View className="mt-6 flex-row justify-center">
            <Text className="text-zinc-400">Don't have an account? </Text>
            <TouchableOpacity
              testID="goto-signup-link"
              onPress={() => router.push('/(auth)/sign-up')}
            >
              <Text className="font-medium text-brand-400">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
