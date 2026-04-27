import { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalWeightWidget } from '@/components/GoalWeightWidget';
import { ProgressChartWidget } from '@/components/ProgressChartWidget';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { trpc } from '@/lib/trpc';
import { kgToLbs, toMetricWeight } from '@/lib/units';
import type { UnitSystem } from '@/lib/units';
import type { GoalMode, User } from '@/store/auth';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { useUnitsStore } from '@/store/units';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract YYYY-MM-DD from an ISO string (or return '' if null). */
function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/**
 * Convert a YYYY-MM-DD string → full UTC ISO string for the API.
 * Returns null if the input is blank.
 */
function dateInputToIso(dateStr: string): string | null {
  if (!dateStr.trim()) return null;
  // Validate basic YYYY-MM-DD shape before converting
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null;
  return `${dateStr.trim()}T00:00:00.000Z`;
}

/**
 * Map the tRPC updateProfile response (SafeUser, where goalTargetDate is
 * typed as Date but arrives as an ISO string over the wire) to the client
 * User type stored in Zustand.
 */
function safeUserToStoreUser(data: {
  id: string;
  email: string;
  name: string;
  goalMode: string | null;
  weightKg: number | null;
  tdeeCalories: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  goalWeightKg: number | null;
  goalTargetDate: string | Date | null;
}): User {
  // goalTargetDate arrives as an ISO string over the tRPC wire even though
  // the server TypeScript type says Date — the typeof guard handles both.
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    goalMode: (data.goalMode as GoalMode | null) ?? null,
    tdeeCalories: data.tdeeCalories,
    calorieTarget: data.calorieTarget,
    proteinTargetG: data.proteinTargetG,
    carbsTargetG: data.carbsTargetG,
    fatTargetG: data.fatTargetG,
    goalWeightKg: data.goalWeightKg,
    goalTargetDate: data.goalTargetDate
      ? typeof data.goalTargetDate === 'string'
        ? data.goalTargetDate
        : data.goalTargetDate.toISOString()
      : null,
  };
}

// ─── Edit profile modal ───────────────────────────────────────────────────────

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  initialName: string;
  initialWeightKg: number | null;
  initialGoalWeightKg: number | null;
  initialGoalTargetDate: string | null;
  unitSystem: UnitSystem;
  onSave: (data: {
    name?: string;
    weightKg?: number;
    goalWeightKg?: number;
    goalTargetDate?: string | null;
  }) => void;
  isPending: boolean;
}

function EditProfileModal({
  visible,
  onClose,
  initialName,
  initialWeightKg,
  initialGoalWeightKg,
  initialGoalTargetDate,
  unitSystem,
  onSave,
  isPending,
}: EditProfileModalProps) {
  const [name, setName] = useState(initialName);
  const keyboardHeight = useKeyboardHeight();
  const [weight, setWeight] = useState(
    initialWeightKg
      ? unitSystem === 'imperial'
        ? kgToLbs(String(initialWeightKg))
        : String(initialWeightKg)
      : '',
  );
  const [goalWeight, setGoalWeight] = useState(
    initialGoalWeightKg
      ? unitSystem === 'imperial'
        ? kgToLbs(String(initialGoalWeightKg))
        : String(initialGoalWeightKg)
      : '',
  );
  // Store as YYYY-MM-DD for the text input; convert to ISO on save
  const [goalTargetDate, setGoalTargetDate] = useState(isoToDateInput(initialGoalTargetDate));

  function handleSave() {
    const data: {
      name?: string;
      weightKg?: number;
      goalWeightKg?: number;
      goalTargetDate?: string | null;
    } = {};
    if (name.trim() && name.trim() !== initialName) data.name = name.trim();
    const wt = parseFloat(weight);
    if (!isNaN(wt) && wt > 0) data.weightKg = toMetricWeight(weight, unitSystem);
    const gw = parseFloat(goalWeight);
    if (!isNaN(gw) && gw > 0) data.goalWeightKg = toMetricWeight(goalWeight, unitSystem);
    // Compare against the initial YYYY-MM-DD display value
    const initialDisplay = isoToDateInput(initialGoalTargetDate);
    if (goalTargetDate !== initialDisplay) {
      data.goalTargetDate = dateInputToIso(goalTargetDate);
    }
    onSave(data);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardHeight }}
          >
            <View
              style={{
                backgroundColor: '#1a1a1a',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
              className="p-5"
            >
              <View className="mb-5 flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-white">Edit Profile</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text className="text-zinc-400">✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 20 : 8 }}
              >
                <Text className="mb-2 text-xs text-zinc-400">Name</Text>
                <TextInput
                  testID="profile-name-input"
                  style={{ backgroundColor: '#222222', color: '#fff' }}
                  className="mb-4 rounded-xl px-4 py-3 text-white"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />

                <Text className="mb-2 text-xs text-zinc-400">
                  Current weight ({unitSystem === 'metric' ? 'kg' : 'lbs'})
                </Text>
                <TextInput
                  testID="profile-weight-input"
                  style={{ backgroundColor: '#222222', color: '#fff' }}
                  className="mb-4 rounded-xl px-4 py-3 text-white"
                  keyboardType="numeric"
                  placeholder={unitSystem === 'imperial' ? 'e.g. 165' : 'e.g. 75'}
                  placeholderTextColor="#52525b"
                  value={weight}
                  onChangeText={setWeight}
                />

                <Text className="mb-2 text-xs text-zinc-400">
                  Goal weight ({unitSystem === 'metric' ? 'kg' : 'lbs'})
                </Text>
                <TextInput
                  testID="profile-goal-weight-input"
                  style={{ backgroundColor: '#222222', color: '#fff' }}
                  className="mb-4 rounded-xl px-4 py-3 text-white"
                  keyboardType="numeric"
                  placeholder={unitSystem === 'imperial' ? 'e.g. 155' : 'e.g. 70'}
                  placeholderTextColor="#52525b"
                  value={goalWeight}
                  onChangeText={setGoalWeight}
                />

                <Text className="mb-2 text-xs text-zinc-400">Target date</Text>
                <TextInput
                  testID="profile-goal-target-date-input"
                  style={{ backgroundColor: '#222222', color: '#fff' }}
                  className="mb-5 rounded-xl px-4 py-3 text-white"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#52525b"
                  value={goalTargetDate}
                  onChangeText={setGoalTargetDate}
                />

                <TouchableOpacity
                  testID="save-changes-btn"
                  onPress={handleSave}
                  disabled={isPending}
                  className="items-center rounded-2xl bg-brand-400 py-4"
                >
                  {isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-base font-semibold text-white">Save changes</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>

              <View style={{ height: Platform.OS === 'ios' ? 20 : 0 }} />
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  bulk: 'Bulk',
  cut: 'Cut',
  maintenance: 'Maintenance',
};

const GOAL_COLORS: Record<string, { bg: string; text: string }> = {
  bulk: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  cut: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  maintenance: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
};

export default function ProfileScreen() {
  const [editModalVisible, setEditModalVisible] = useState(false);

  const { unitSystem, setUnitSystem } = useUnitsStore();
  const { setUser } = useAuthStore();
  const signOut = useAuthStore((s) => s.signOut);
  const showError = useToastStore((s) => s.showError);
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: 300_000 });
  const user = meQuery.data;

  const updateProfileMut = trpc.user.updateProfile.useMutation({
    onSuccess: (data) => {
      setUser(safeUserToStoreUser(data));
      utils.auth.me.invalidate();
      setEditModalVisible(false);
    },
    onError: (err) => showError(err.message),
  });

  const updateSettingsMut = trpc.user.updateSettings.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
    onError: (err) => showError(err.message),
  });

  function handleUnitToggle(u: UnitSystem) {
    setUnitSystem(u); // optimistic local update
    updateSettingsMut.mutate({ unitSystem: u });
  }

  const goalColor = user?.goalMode
    ? (GOAL_COLORS[user.goalMode] ?? GOAL_COLORS['maintenance']!)
    : null;

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="mb-6 text-2xl font-semibold text-white">Profile</Text>

        {meQuery.isLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator color="#1a9e6e" size="large" />
          </View>
        ) : (
          <>
            {/* Avatar + name */}
            <View className="mb-8 items-center">
              <View className="mb-3 h-20 w-20 items-center justify-center rounded-full border-2 border-brand-400 bg-brand-400/20">
                <Text className="text-2xl font-semibold text-brand-400">{initials}</Text>
              </View>
              <Text className="text-lg font-semibold text-white">{user?.name ?? 'Your Name'}</Text>
              <Text className="text-sm text-zinc-500">{user?.email ?? ''}</Text>
              <TouchableOpacity
                testID="edit-profile-btn"
                onPress={() => setEditModalVisible(true)}
                className="mt-2 rounded-lg bg-surface-border px-4 py-1.5"
              >
                <Text className="text-xs font-medium text-zinc-300">Edit profile</Text>
              </TouchableOpacity>
            </View>

            {/* Goal badge */}
            <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4">
              <Text className="text-sm text-zinc-400">Current goal</Text>
              {user?.goalMode && goalColor ? (
                <View
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    backgroundColor: goalColor.bg,
                  }}
                >
                  <Text style={{ color: goalColor.text, fontWeight: '600', fontSize: 13 }}>
                    {GOAL_LABELS[user.goalMode] ?? user.goalMode}
                  </Text>
                </View>
              ) : (
                <View className="rounded-full bg-amber-400/15 px-3 py-1">
                  <Text className="text-sm font-medium text-amber-400">Not set</Text>
                </View>
              )}
            </View>

            {/* Stats */}
            <View className="mb-4 flex-row gap-3">
              {[
                {
                  label: 'TDEE',
                  val: user?.tdeeCalories ? `${user.tdeeCalories}` : '—',
                  unit: 'kcal',
                },
                {
                  label: 'Target',
                  val: user?.calorieTarget ? `${user.calorieTarget}` : '—',
                  unit: 'kcal',
                },
                {
                  label: 'Weight',
                  val: user?.weightKg
                    ? unitSystem === 'imperial'
                      ? kgToLbs(String(user.weightKg))
                      : `${user.weightKg}`
                    : '—',
                  unit: unitSystem === 'metric' ? 'kg' : 'lbs',
                },
              ].map((s) => (
                <View
                  key={s.label}
                  className="flex-1 rounded-2xl border border-surface-border bg-surface-card p-3"
                >
                  <Text className="text-xs text-zinc-500">{s.label}</Text>
                  <Text className="mt-1 text-base font-semibold text-white">{s.val}</Text>
                  {s.val !== '—' && <Text className="text-xs text-zinc-600">{s.unit}</Text>}
                </View>
              ))}
            </View>

            {/* Goal weight widget */}
            <GoalWeightWidget
              currentWeightKg={user?.weightKg ?? null}
              goalWeightKg={user?.goalWeightKg ?? null}
              goalTargetDate={user?.goalTargetDate ?? null}
              goalMode={(user?.goalMode as GoalMode | null) ?? null}
              unitSystem={unitSystem}
            />

            {/* Progress chart widget */}
            <ProgressChartWidget
              goalWeightKg={user?.goalWeightKg ?? null}
              unitSystem={unitSystem}
            />

            {/* Settings rows */}
            <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Settings
            </Text>

            {/* Unit system */}
            <View className="mb-2 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card px-4 py-3.5">
              <Text className="text-sm font-medium text-white">Units</Text>
              <View
                style={{
                  flexDirection: 'row',
                  borderRadius: 10,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#2e2e2e',
                }}
              >
                {(['metric', 'imperial'] as UnitSystem[]).map((u) => (
                  <TouchableOpacity
                    key={u}
                    testID={u === 'metric' ? 'unit-btn-kg' : 'unit-btn-lbs'}
                    onPress={() => handleUnitToggle(u)}
                    style={{
                      backgroundColor: unitSystem === u ? '#1a9e6e' : '#222222',
                      paddingHorizontal: 16,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: unitSystem === u ? '#ffffff' : '#71717a',
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      {u === 'metric' ? 'kg' : 'lbs'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notifications row */}
            <TouchableOpacity className="mb-2 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card px-4 py-3.5">
              <Text className="text-sm font-medium text-white">Notifications</Text>
              <Text className="text-zinc-600">›</Text>
            </TouchableOpacity>

            {/* Sign out */}
            <TouchableOpacity
              testID="sign-out-btn"
              onPress={() => signOut()}
              className="mb-2 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card px-4 py-3.5"
            >
              <Text className="text-sm font-medium text-red-400">Sign out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {user && (
        <EditProfileModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          initialName={user.name}
          initialWeightKg={user.weightKg}
          initialGoalWeightKg={user.goalWeightKg}
          initialGoalTargetDate={user.goalTargetDate}
          unitSystem={unitSystem}
          onSave={(data) => updateProfileMut.mutate(data)}
          isPending={updateProfileMut.isPending}
        />
      )}
    </SafeAreaView>
  );
}
