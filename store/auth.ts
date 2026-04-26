import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

const TOKEN_KEY = 'fitapp_auth_token';
const ONBOARDED_KEY = 'fitapp_onboarded';

// expo-secure-store is native-only; fall back to localStorage on web
const storage = {
  getItem: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(void localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  deleteItem: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(void localStorage.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};

export type GoalMode = 'bulk' | 'maintenance' | 'cut';

export interface User {
  id: string;
  email: string;
  name: string;
  goalMode: GoalMode | null;
  tdeeCalories: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  goalWeightKg: number | null;
  goalTargetDate: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isOnboarded: boolean;
  hydrate: () => Promise<void>;
  setAuth: (user: User, token: string) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  setOnboarded: (value: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isOnboarded: false,

  hydrate: async () => {
    try {
      const token = await storage.getItem(TOKEN_KEY);
      const onboardedStr = await storage.getItem(ONBOARDED_KEY);
      set({ token: token ?? null, isLoading: false, isOnboarded: onboardedStr === 'true' });
    } catch {
      set({ isLoading: false });
    }
  },

  setAuth: async (user: User, token: string) => {
    await storage.setItem(TOKEN_KEY, token);
    const onboarded = user.goalMode !== null;
    await storage.setItem(ONBOARDED_KEY, String(onboarded));
    set({ user, token, isOnboarded: onboarded });
  },

  setUser: async (user: User) => {
    const onboarded = user.goalMode !== null;
    await storage.setItem(ONBOARDED_KEY, String(onboarded));
    set({ user, isOnboarded: onboarded });
  },

  setOnboarded: async (value: boolean) => {
    await storage.setItem(ONBOARDED_KEY, String(value));
    set({ isOnboarded: value });
  },

  signOut: async () => {
    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(ONBOARDED_KEY);
    set({ user: null, token: null, isOnboarded: false });
  },
}));
