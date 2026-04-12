import { create } from "zustand";

export type GoalMode = "bulk" | "maintenance" | "cut";

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
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isOnboarded: boolean;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setOnboarded: (value: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isOnboarded: false,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setOnboarded: (value) => set({ isOnboarded: value }),

  signOut: () =>
    set({ user: null, token: null, isOnboarded: false }),
}));
