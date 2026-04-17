import { create } from 'zustand';

export type ToastVariant = 'error' | 'warning' | 'info' | 'success';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant) => void;
  showError: (message: string) => void;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  showToast: (message, variant = 'error') =>
    set((state) => ({
      toasts: [...state.toasts, { id: String(Date.now()), message, variant }],
    })),

  showError: (message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: String(Date.now()), message, variant: 'error' }],
    })),

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clearAll: () => set({ toasts: [] }),
}));
