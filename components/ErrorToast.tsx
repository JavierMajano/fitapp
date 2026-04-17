import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '@store/toast';
import type { Toast } from '@store/toast';

const AUTO_DISMISS_MS = 4000;

const VARIANT_BORDER: Record<string, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#1a9e6e',
  info: '#3b82f6',
};

function ToastItem({ id, message, variant }: Toast) {
  const dismiss = useToastStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <Pressable
      onPress={() => dismiss(id)}
      style={[styles.toast, { borderLeftColor: VARIANT_BORDER[variant] ?? VARIANT_BORDER.error }]}
    >
      <Text style={styles.message}>{message}</Text>
    </Pressable>
  );
}

export function ErrorToast() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + 8 }]}>
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  message: {
    color: '#f5f5f5',
    fontSize: 14,
    lineHeight: 20,
  },
});
