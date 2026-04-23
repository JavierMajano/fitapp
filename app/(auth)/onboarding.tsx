import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPresetDates, formatTargetDate, getPaceLabel } from '@/lib/goalCalculations';
import { trpc } from '@/lib/trpc';
import {
  type UnitSystem,
  cmToIn,
  inToCm,
  kgToLbs,
  lbsToKg,
  toMetricHeight,
  toMetricWeight,
  WEIGHT_BOUNDS,
  HEIGHT_BOUNDS,
} from '@/lib/units';
import { useAuthStore } from '@/store/auth';
import type { GoalMode, User } from '@/store/auth';

// ── Types ──────────────────────────────────────────────────────────────────

type Sex = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

interface FormData {
  name: string;
  weightKg: string;
  heightCm: string;
  age: string;
  sex: Sex;
  goalMode: GoalMode;
  goalWeightKg: string;
  goalTargetDate: string;
  activityLevel: ActivityLevel;
}

// ── TDEE preview (mirrors server logic) ───────────────────────────────────

function calcPreview(data: FormData, unit: UnitSystem) {
  const weight = toMetricWeight(data.weightKg, unit);
  const height = toMetricHeight(data.heightCm, unit);
  const age = parseInt(data.age, 10);
  if (!weight || !height || !age) return null;

  const bmr =
    data.sex === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const adjustments: Record<GoalMode, number> = { bulk: 400, maintenance: 0, cut: -400 };

  const tdee = Math.round(bmr * multipliers[data.activityLevel]);
  const calories = tdee + adjustments[data.goalMode];
  const protein = Math.round(weight * 2);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { tdee, calories, protein, fat, carbs };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View className="mb-8 flex-row gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1 flex-1 rounded-full ${i < current ? 'bg-brand-400' : i === current ? 'bg-brand-400' : 'bg-surface-border'}`}
          style={{ opacity: i <= current ? 1 : 0.4 }}
        />
      ))}
    </View>
  );
}

function OptionCard({
  label,
  sublabel,
  selected,
  color,
  onPress,
  testID,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  color?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      className={`mb-3 flex-row items-center justify-between rounded-2xl border p-4 ${
        selected ? 'border-brand-400 bg-brand-400/10' : 'border-surface-border bg-surface-card'
      }`}
    >
      <View className="flex-1">
        <Text className={`font-medium ${selected ? 'text-white' : 'text-zinc-300'}`}>{label}</Text>
        {sublabel ? <Text className="mt-0.5 text-xs text-zinc-500">{sublabel}</Text> : null}
      </View>
      {color ? (
        <View className={`mr-2 h-3 w-3 rounded-full`} style={{ backgroundColor: color }} />
      ) : null}
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? 'border-brand-400' : 'border-zinc-600'
        }`}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-brand-400" /> : null}
      </View>
    </TouchableOpacity>
  );
}

function MacroChip({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-surface-border bg-surface-card p-3">
      <View className="mb-1 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-base font-semibold text-white">{value}</Text>
      <Text className="text-xs text-zinc-500">{unit}</Text>
      <Text className="mt-0.5 text-xs text-zinc-400">{label}</Text>
    </View>
  );
}

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric  (kg / cm)' },
  { value: 'imperial', label: 'Imperial  (lbs / in)' },
];

function UnitDropdown({
  value,
  onChange,
  hasError,
}: {
  value: UnitSystem;
  onChange: (u: UnitSystem) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = UNIT_OPTIONS.find((o) => o.value === value)!;

  return (
    <View className="relative mb-4" style={{ zIndex: 20 }}>
      <Text className="mb-2 text-sm text-zinc-400">Units</Text>

      {/* Trigger */}
      <TouchableOpacity
        testID="onboard-unit-dropdown"
        onPress={() => setOpen((v) => !v)}
        className={`flex-row items-center justify-between rounded-xl border px-4 py-3.5 ${
          hasError ? 'border-red-500 bg-red-500/5' : 'border-surface-border bg-surface-card'
        }`}
      >
        <Text className="text-base text-white">{selected.label}</Text>
        <Text className="text-zinc-400">{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Dropdown list — zIndex inline required for RN web stacking context */}
      {open && (
        <View
          className="absolute left-0 right-0 top-[72px] rounded-xl border border-surface-border bg-surface-card shadow-lg"
          style={{ zIndex: 50 }}
        >
          {UNIT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              testID={opt.value === 'metric' ? 'onboard-unit-metric' : 'onboard-unit-imperial'}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex-row items-center justify-between px-4 py-3.5 ${
                opt.value === value ? 'bg-brand-400/10' : ''
              }`}
            >
              <Text
                className={`text-base ${opt.value === value ? 'font-medium text-brand-400' : 'text-zinc-300'}`}
              >
                {opt.label}
              </Text>
              {opt.value === value && <Text className="text-brand-400">✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

export default function OnboardingScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    name: user?.name ?? '',
    weightKg: '',
    heightCm: '',
    age: '',
    sex: 'male',
    goalMode: 'maintenance',
    goalWeightKg: '',
    goalTargetDate: '',
    activityLevel: 'moderate',
  });
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [error, setError] = useState('');

  const completeOnboard = trpc.user.completeOnboard.useMutation({
    onSuccess: (updatedUser) => {
      const storeUser: User = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        goalMode: updatedUser.goalMode as GoalMode | null,
        tdeeCalories: updatedUser.tdeeCalories,
        calorieTarget: updatedUser.calorieTarget,
        proteinTargetG: updatedUser.proteinTargetG,
        carbsTargetG: updatedUser.carbsTargetG,
        fatTargetG: updatedUser.fatTargetG,
        goalWeightKg: updatedUser.goalWeightKg,
        goalTargetDate: updatedUser.goalTargetDate
          ? new Date(updatedUser.goalTargetDate).toISOString()
          : null,
      };
      setUser(storeUser);
      // AuthGuard will see isOnboarded=true and redirect to tabs
    },
    onError: (e) => setError(e.message),
  });

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleUnitToggle = (newUnit: UnitSystem) => {
    if (newUnit === unitSystem) return;
    setForm((prev) => ({
      ...prev,
      weightKg: newUnit === 'imperial' ? kgToLbs(prev.weightKg) : lbsToKg(prev.weightKg),
      heightCm: newUnit === 'imperial' ? cmToIn(prev.heightCm) : inToCm(prev.heightCm),
    }));
    setUnitSystem(newUnit);
    setError('');
  };

  const validateStep = (): boolean => {
    if (step === 0 && !form.name.trim()) {
      setError('Please enter your name.');
      return false;
    }
    if (step === 1) {
      const w = parseFloat(form.weightKg);
      const h = parseFloat(form.heightCm);
      const a = parseInt(form.age, 10);
      const wMax = WEIGHT_BOUNDS[unitSystem].max;
      const hMax = HEIGHT_BOUNDS[unitSystem].max;
      const wUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';
      const hUnit = unitSystem === 'imperial' ? 'in' : 'cm';

      if (!w || w <= 0 || w > wMax) {
        setError(`Enter a valid weight (${wUnit}).`);
        return false;
      }
      if (!h || h <= 0 || h > hMax) {
        setError(`Enter a valid height (${hUnit}).`);
        return false;
      }
      if (!a || a < 13 || a > 120) {
        setError('Enter a valid age (13–120).');
        return false;
      }
    }
    if (step === 3) {
      const gw = parseFloat(form.goalWeightKg);
      const wMax = WEIGHT_BOUNDS[unitSystem].max;
      const wUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';

      if (!gw || gw <= 0 || gw > wMax) {
        setError(`Enter a valid goal weight (${wUnit}).`);
        return false;
      }
      if (!form.goalTargetDate) {
        setError('Please select or enter a target date.');
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const back = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const finish = () => {
    setError('');
    completeOnboard.mutate({
      goalMode: form.goalMode,
      weightKg: toMetricWeight(form.weightKg, unitSystem),
      heightCm: toMetricHeight(form.heightCm, unitSystem),
      age: parseInt(form.age, 10),
      sex: form.sex,
      activityLevel: form.activityLevel,
      goalWeightKg: toMetricWeight(form.goalWeightKg, unitSystem),
      goalTargetDate: form.goalTargetDate,
    });
  };

  const preview = step === 5 ? calcPreview(form, unitSystem) : null;

  const goalColors: Record<GoalMode, string> = {
    bulk: '#f59e0b',
    maintenance: '#3b82f6',
    cut: '#ef4444',
  };

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6 pt-8"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepIndicator current={step} total={TOTAL_STEPS} />

          {/* ── Step 0: Name ── */}
          {step === 0 && (
            <View>
              <Text className="mb-1 text-2xl font-bold text-white">What's your name?</Text>
              <Text className="mb-8 text-sm text-zinc-400">We'll personalise your experience.</Text>
              <Text className="mb-2 text-sm text-zinc-400">Name</Text>
              <TextInput
                testID="onboard-name-input"
                className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5 text-base text-white"
                placeholder="Your name"
                placeholderTextColor="#52525b"
                autoCapitalize="words"
                value={form.name}
                onChangeText={(v) => set('name', v)}
                returnKeyType="next"
                onSubmitEditing={next}
              />
            </View>
          )}

          {/* ── Step 1: Measurements ── */}
          {step === 1 && (
            <View>
              <Text className="mb-1 text-2xl font-bold text-white">Your measurements</Text>
              <Text className="mb-8 text-sm text-zinc-400">
                Used to calculate your calorie targets.
              </Text>

              {/* Unit system dropdown */}
              <UnitDropdown value={unitSystem} onChange={handleUnitToggle} hasError={false} />

              <View className="mb-4 flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-2 text-sm text-zinc-400">
                    {unitSystem === 'metric' ? 'Weight (kg)' : 'Weight (lbs)'}
                  </Text>
                  <TextInput
                    testID="onboard-weight-input"
                    className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5 text-base text-white"
                    placeholder={unitSystem === 'metric' ? '70' : '154'}
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    value={form.weightKg}
                    onChangeText={(v) => set('weightKg', v)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-2 text-sm text-zinc-400">
                    {unitSystem === 'metric' ? 'Height (cm)' : 'Height (in)'}
                  </Text>
                  <TextInput
                    testID="onboard-height-input"
                    className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5 text-base text-white"
                    placeholder={unitSystem === 'metric' ? '175' : '69'}
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    value={form.heightCm}
                    onChangeText={(v) => set('heightCm', v)}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="mb-2 text-sm text-zinc-400">Age</Text>
                <TextInput
                  testID="onboard-age-input"
                  className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5 text-base text-white"
                  placeholder="25"
                  placeholderTextColor="#52525b"
                  keyboardType="number-pad"
                  value={form.age}
                  onChangeText={(v) => set('age', v)}
                />
              </View>

              <Text className="mb-2 text-sm text-zinc-400">Sex</Text>
              <View className="flex-row gap-3">
                {(['male', 'female'] as Sex[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    testID={s === 'male' ? 'onboard-sex-male' : 'onboard-sex-female'}
                    onPress={() => set('sex', s)}
                    className={`flex-1 items-center rounded-xl border py-3.5 ${
                      form.sex === s
                        ? 'border-brand-400 bg-brand-400/10'
                        : 'border-surface-border bg-surface-card'
                    }`}
                  >
                    <Text
                      className={`font-medium capitalize ${form.sex === s ? 'text-brand-400' : 'text-zinc-400'}`}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 2: Goal ── */}
          {step === 2 && (
            <View>
              <Text className="mb-1 text-2xl font-bold text-white">What's your goal?</Text>
              <Text className="mb-8 text-sm text-zinc-400">
                This sets your calorie surplus or deficit.
              </Text>

              <OptionCard
                label="Bulk"
                sublabel="+400 kcal surplus · build muscle"
                selected={form.goalMode === 'bulk'}
                color="#f59e0b"
                onPress={() => set('goalMode', 'bulk')}
                testID="onboard-goal-bulk"
              />
              <OptionCard
                label="Maintenance"
                sublabel="Eat at TDEE · body recomposition"
                selected={form.goalMode === 'maintenance'}
                color="#3b82f6"
                onPress={() => set('goalMode', 'maintenance')}
                testID="onboard-goal-maintenance"
              />
              <OptionCard
                label="Cut"
                sublabel="−400 kcal deficit · lose fat"
                selected={form.goalMode === 'cut'}
                color="#ef4444"
                onPress={() => set('goalMode', 'cut')}
                testID="onboard-goal-cut"
              />
            </View>
          )}

          {/* ── Step 3: Goal weight & target date ── */}
          {step === 3 && (
            <View>
              <Text className="mb-1 text-2xl font-bold text-white">Goal weight</Text>
              <Text className="mb-8 text-sm text-zinc-400">When do you want to reach it?</Text>

              {/* Goal weight input */}
              <View className="mb-6">
                <Text className="mb-2 text-sm text-zinc-400">
                  Goal weight ({unitSystem === 'metric' ? 'kg' : 'lbs'})
                </Text>
                <TextInput
                  testID="onboard-goal-weight-input"
                  className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5 text-base text-white"
                  placeholder={unitSystem === 'metric' ? '75' : '165'}
                  placeholderTextColor="#52525b"
                  keyboardType="decimal-pad"
                  value={form.goalWeightKg}
                  onChangeText={(v) => set('goalWeightKg', v)}
                />
              </View>

              {/* Preset date buttons */}
              {form.goalWeightKg && !error ? (
                <View className="mb-6">
                  <Text className="mb-3 text-sm text-zinc-400">Target date</Text>
                  {(() => {
                    const currentWeight = parseFloat(form.weightKg);
                    const goalWeight = parseFloat(form.goalWeightKg);
                    if (!currentWeight || !goalWeight) return null;

                    const presets = getPresetDates(
                      currentWeight,
                      goalWeight,
                      form.goalMode,
                      unitSystem,
                    );
                    const paceNames: ('slow' | 'normal' | 'fast')[] = ['slow', 'normal', 'fast'];

                    return (
                      <View className="gap-2">
                        {paceNames.map((pace) => {
                          const isoDate = presets[pace];
                          const isSelected = form.goalTargetDate === isoDate;
                          const label = getPaceLabel(
                            currentWeight,
                            goalWeight,
                            form.goalMode,
                            unitSystem,
                            pace,
                          );
                          const dateStr = formatTargetDate(isoDate);

                          return (
                            <TouchableOpacity
                              key={pace}
                              testID={`onboard-preset-${pace}`}
                              onPress={() => set('goalTargetDate', isoDate)}
                              className={`rounded-xl border p-4 ${
                                isSelected
                                  ? 'border-brand-400 bg-brand-400/10'
                                  : 'border-surface-border bg-surface-card'
                              }`}
                            >
                              <Text
                                className={`text-sm font-medium ${isSelected ? 'text-brand-400' : 'text-zinc-300'}`}
                              >
                                {pace.charAt(0).toUpperCase() + pace.slice(1)} — {label}
                              </Text>
                              <Text
                                className={`mt-1 text-xs ${isSelected ? 'text-brand-400/80' : 'text-zinc-500'}`}
                              >
                                {dateStr}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })()}
                </View>
              ) : null}

              {/* Manual date input fallback */}
              <View>
                <Text className="mb-2 text-sm text-zinc-400">Or enter a custom date</Text>
                <TextInput
                  testID="onboard-custom-date-input"
                  className="rounded-xl border border-surface-border bg-surface-card px-4 py-3.5 text-base text-white"
                  placeholder="2026-06-15T00:00:00Z"
                  placeholderTextColor="#52525b"
                  value={form.goalTargetDate}
                  onChangeText={(v) => set('goalTargetDate', v)}
                />
              </View>
            </View>
          )}

          {/* ── Step 4: Activity level ── */}
          {step === 4 && (
            <View>
              <Text className="mb-1 text-2xl font-bold text-white">Activity level</Text>
              <Text className="mb-8 text-sm text-zinc-400">
                How active are you outside the gym?
              </Text>

              {(
                [
                  ['sedentary', 'Sedentary', 'Desk job, little or no exercise'],
                  ['light', 'Lightly active', 'Light exercise 1–3 days/week'],
                  ['moderate', 'Moderately active', 'Moderate exercise 3–5 days/week'],
                  ['active', 'Active', 'Hard exercise 6–7 days/week'],
                  ['very_active', 'Very active', 'Physical job + hard training'],
                ] as [ActivityLevel, string, string][]
              ).map(([value, label, sublabel]) => (
                <OptionCard
                  key={value}
                  testID={`onboard-activity-${value}`}
                  label={label}
                  sublabel={sublabel}
                  selected={form.activityLevel === value}
                  onPress={() => set('activityLevel', value)}
                />
              ))}
            </View>
          )}

          {/* ── Step 5: TDEE preview ── */}
          {step === 5 && (
            <View>
              <Text className="mb-1 text-2xl font-bold text-white">Your targets</Text>
              <Text className="mb-8 text-sm text-zinc-400">
                Based on your profile. You can adjust these later.
              </Text>

              {preview ? (
                <>
                  {/* Calorie card */}
                  <View className="mb-4 items-center rounded-2xl border border-surface-border bg-surface-card p-5">
                    <View
                      className="mb-2 h-3 w-3 rounded-full"
                      style={{ backgroundColor: goalColors[form.goalMode] }}
                    />
                    <Text className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
                      Daily calorie target
                    </Text>
                    <Text testID="onboard-tdee-value" className="text-4xl font-bold text-white">
                      {preview.calories}
                    </Text>
                    <Text className="mt-1 text-xs text-zinc-500">kcal/day</Text>
                    <Text className="mt-2 text-xs text-zinc-600">
                      TDEE {preview.tdee} kcal
                      {form.goalMode === 'bulk' ? ' +400' : form.goalMode === 'cut' ? ' −400' : ''}
                    </Text>
                  </View>

                  {/* Macro breakdown */}
                  <View className="flex-row gap-3">
                    <MacroChip label="Protein" value={preview.protein} unit="g" color="#a78bfa" />
                    <MacroChip label="Carbs" value={preview.carbs} unit="g" color="#fb923c" />
                    <MacroChip label="Fat" value={preview.fat} unit="g" color="#facc15" />
                  </View>
                </>
              ) : (
                <View className="items-center rounded-2xl border border-surface-border bg-surface-card p-5">
                  <Text className="text-sm text-zinc-400">
                    Complete the previous steps to see your targets.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Error ── */}
          {error ? (
            <View className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <Text className="text-sm text-red-400">{error}</Text>
            </View>
          ) : null}

          {/* ── Navigation buttons ── */}
          <View className="mt-8 flex-row gap-3">
            {step > 0 && (
              <TouchableOpacity
                onPress={back}
                className="flex-1 items-center rounded-xl border border-surface-border py-4"
              >
                <Text className="font-medium text-zinc-300">Back</Text>
              </TouchableOpacity>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <TouchableOpacity
                testID="onboard-continue-btn"
                onPress={next}
                className="flex-1 items-center rounded-xl bg-brand-400 py-4"
              >
                <Text className="font-semibold text-white">Continue</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID="onboard-finish-btn"
                onPress={finish}
                disabled={completeOnboard.isPending || !preview}
                className={`flex-1 items-center rounded-xl py-4 ${
                  completeOnboard.isPending || !preview ? 'bg-brand-400/50' : 'bg-brand-400'
                }`}
              >
                {completeOnboard.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-semibold text-white">Let's go!</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
