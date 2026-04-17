import { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateNav } from '@/components/DateNav';
import { displayWeight, toMetricWeight } from '@/lib/units';
import { useFitLog, MOCK_EXERCISES, type LoggedSet, type WorkoutSession } from '@/store/fitlog';
import { useUnitsStore } from '@/store/units';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function prevDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
}

function nextDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const STARTER_ROUTINES = [
  { name: 'Push / Pull / Legs', days: '6-day split', tag: 'bulk' as const },
  { name: 'Upper / Lower', days: '4-day split', tag: 'maint' as const },
  { name: 'Full Body', days: '3-day split', tag: 'cut' as const },
];

// ─── Elapsed timer hook ───────────────────────────────────────────────────────

function useElapsed(startedAt: number | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt === undefined) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    ref.current = setInterval(tick, 1000);
    return () => {
      if (ref.current !== null) clearInterval(ref.current);
    };
  }, [startedAt]);

  return elapsed;
}

// ─── Start session modal ──────────────────────────────────────────────────────

interface StartSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onStart: (name: string) => void;
}

function StartSessionModal({ visible, onClose, onStart }: StartSessionModalProps) {
  const [name, setName] = useState('');

  function handleStart(preset?: string) {
    const sessionName = preset ?? name.trim();
    if (!sessionName) return;
    onStart(sessionName);
    setName('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View
              style={{
                backgroundColor: '#1a1a1a',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
              className="p-5"
            >
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-white">Start Session</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text className="text-zinc-400">✕</Text>
                </TouchableOpacity>
              </View>

              <Text className="mb-2 text-xs text-zinc-400">Session name</Text>
              <TextInput
                style={{ backgroundColor: '#222222', color: '#fff' }}
                className="mb-4 rounded-xl px-4 py-3 text-white"
                placeholder="e.g. Push Day"
                placeholderTextColor="#52525b"
                value={name}
                onChangeText={setName}
                autoFocus
              />

              <TouchableOpacity
                onPress={() => handleStart()}
                className="mb-4 items-center rounded-2xl bg-brand-400 py-4"
              >
                <Text className="text-base font-semibold text-white">Start Empty Session</Text>
              </TouchableOpacity>

              <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
                or pick a routine
              </Text>
              {STARTER_ROUTINES.map((r) => (
                <TouchableOpacity
                  key={r.name}
                  onPress={() => handleStart(r.name)}
                  className="mb-2 flex-row items-center justify-between rounded-2xl border border-surface-border p-4"
                >
                  <View>
                    <Text className="font-medium text-white">{r.name}</Text>
                    <Text className="text-xs text-zinc-500">{r.days}</Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      backgroundColor:
                        r.tag === 'bulk'
                          ? 'rgba(245,158,11,0.15)'
                          : r.tag === 'cut'
                            ? 'rgba(239,68,68,0.15)'
                            : 'rgba(59,130,246,0.15)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color:
                          r.tag === 'bulk' ? '#f59e0b' : r.tag === 'cut' ? '#ef4444' : '#3b82f6',
                      }}
                    >
                      {r.tag}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              <View style={{ height: Platform.OS === 'ios' ? 20 : 0 }} />
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Log set modal ────────────────────────────────────────────────────────────

interface LogSetModalProps {
  visible: boolean;
  onClose: () => void;
  onLog: (exercise: string, weightKg: number, reps: number) => void;
  nextSetNumber: number;
}

function LogSetModal({ visible, onClose, onLog, nextSetNumber }: LogSetModalProps) {
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [step, setStep] = useState<'exercise' | 'details'>('exercise');

  const { unitSystem } = useUnitsStore();
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  const filtered = exerciseQuery
    ? MOCK_EXERCISES.filter((e) => e.toLowerCase().includes(exerciseQuery.toLowerCase()))
    : MOCK_EXERCISES;

  function handleLog() {
    if (!selectedExercise) return;
    const rawWeight = parseFloat(weight) || 0;
    // Always store in kg regardless of display unit
    const weightKg = toMetricWeight(String(rawWeight), unitSystem);
    onLog(selectedExercise, weightKg, parseInt(reps, 10) || 0);
    setExerciseQuery('');
    setSelectedExercise('');
    setWeight('');
    setReps('');
    setStep('exercise');
    onClose();
  }

  function handleClose() {
    setExerciseQuery('');
    setSelectedExercise('');
    setWeight('');
    setReps('');
    setStep('exercise');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={handleClose}>
        <Pressable onPress={() => {}} style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View
              style={{
                backgroundColor: '#1a1a1a',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
              className="p-5"
            >
              <View className="mb-4 flex-row items-center justify-between">
                {step === 'details' ? (
                  <TouchableOpacity onPress={() => setStep('exercise')}>
                    <Text className="text-sm font-medium text-brand-400">‹ Back</Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-lg font-semibold text-white">Log Set</Text>
                )}
                <TouchableOpacity onPress={handleClose}>
                  <Text className="text-zinc-400">✕</Text>
                </TouchableOpacity>
              </View>

              {step === 'exercise' ? (
                <>
                  <TextInput
                    style={{ backgroundColor: '#222222', color: '#fff' }}
                    className="mb-3 rounded-xl px-4 py-3 text-white"
                    placeholder="Search exercise…"
                    placeholderTextColor="#52525b"
                    value={exerciseQuery}
                    onChangeText={setExerciseQuery}
                    autoFocus
                  />
                  <FlatList
                    data={filtered}
                    keyExtractor={(item) => item}
                    style={{ maxHeight: 320 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedExercise(item);
                          setStep('details');
                        }}
                        className="border-b border-surface-border py-3.5"
                      >
                        <Text className="text-sm text-white">{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              ) : (
                <>
                  <View className="mb-4 rounded-2xl border border-surface-border bg-surface-input p-3">
                    <Text className="text-sm font-semibold text-white">{selectedExercise}</Text>
                    <Text className="text-xs text-zinc-500">Set #{nextSetNumber}</Text>
                  </View>

                  <View className="mb-4 flex-row gap-3">
                    <View className="flex-1">
                      <Text className="mb-2 text-xs text-zinc-400">Weight ({unitLabel})</Text>
                      <TextInput
                        style={{ backgroundColor: '#222222', color: '#fff' }}
                        className="rounded-xl px-4 py-3 text-white"
                        placeholder="0"
                        placeholderTextColor="#52525b"
                        keyboardType="numeric"
                        value={weight}
                        onChangeText={setWeight}
                        autoFocus
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="mb-2 text-xs text-zinc-400">Reps</Text>
                      <TextInput
                        style={{ backgroundColor: '#222222', color: '#fff' }}
                        className="rounded-xl px-4 py-3 text-white"
                        placeholder="0"
                        placeholderTextColor="#52525b"
                        keyboardType="numeric"
                        value={reps}
                        onChangeText={setReps}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleLog}
                    className="items-center rounded-2xl bg-brand-400 py-4"
                  >
                    <Text className="text-base font-semibold text-white">
                      Log Set · {weight || '0'} {unitLabel} × {reps || '0'} reps
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <View style={{ height: Platform.OS === 'ios' ? 20 : 0 }} />
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Active session view ──────────────────────────────────────────────────────

interface ActiveSessionViewProps {
  session: WorkoutSession;
  onAddSet: () => void;
  onEnd: () => void;
  onCancel: () => void;
}

function ActiveSessionView({ session, onAddSet, onEnd, onCancel }: ActiveSessionViewProps) {
  const elapsed = useElapsed(session.startedAt);
  const { unitSystem } = useUnitsStore();
  const colHeader = unitSystem === 'metric' ? 'KG' : 'LBS';

  // Group sets by exercise
  const grouped = session.sets.reduce<Record<string, LoggedSet[]>>((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = [];
    acc[s.exerciseName].push(s);
    return acc;
  }, {});

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-bold text-white">{session.name}</Text>
            <Text className="text-sm text-brand-400">{formatDuration(elapsed)} elapsed</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={onCancel}
              className="rounded-xl border border-surface-border px-3 py-2"
            >
              <Text className="text-sm text-zinc-400">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onEnd} className="rounded-xl bg-brand-400 px-3 py-2">
              <Text className="text-sm font-semibold text-white">Finish</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sets list */}
        {Object.keys(grouped).length === 0 ? (
          <View className="mb-4 items-center rounded-2xl border border-dashed border-surface-border p-8">
            <Text className="mb-1 text-base font-medium text-zinc-400">No sets logged yet</Text>
            <Text className="text-center text-xs text-zinc-600">
              Tap "Add Set" to start tracking your lifts
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([exercise, sets]) => (
            <View
              key={exercise}
              className="mb-3 rounded-2xl border border-surface-border bg-surface-card p-4"
            >
              <Text className="mb-3 font-semibold text-white">{exercise}</Text>
              <View className="flex-row">
                <Text className="flex-1 text-xs font-medium text-zinc-500">SET</Text>
                <Text className="w-20 text-right text-xs font-medium text-zinc-500">
                  {colHeader}
                </Text>
                <Text className="w-16 text-right text-xs font-medium text-zinc-500">REPS</Text>
              </View>
              {sets.map((s) => (
                <View
                  key={s.id}
                  className="mt-2 flex-row items-center border-t border-surface-border pt-2"
                >
                  <View className="flex-1">
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-400/20">
                      <Text className="text-xs font-bold text-brand-400">{s.setNumber}</Text>
                    </View>
                  </View>
                  <Text className="w-20 text-right text-sm font-medium text-white">
                    {unitSystem === 'imperial'
                      ? parseFloat((s.weightKg / 0.453592).toFixed(1))
                      : s.weightKg}
                  </Text>
                  <Text className="w-16 text-right text-sm font-medium text-white">{s.reps}</Text>
                </View>
              ))}
            </View>
          ))
        )}

        {/* Add set button */}
        <TouchableOpacity
          onPress={onAddSet}
          className="mb-4 items-center rounded-2xl border border-brand-400 py-4"
        >
          <Text className="text-base font-semibold text-brand-400">+ Add Set</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Completed session card ───────────────────────────────────────────────────

function SessionCard({ session }: { session: WorkoutSession }) {
  const { unitSystem } = useUnitsStore();
  const duration = session.endedAt
    ? formatDuration(session.endedAt - session.startedAt)
    : 'in progress';
  const exercises = [...new Set(session.sets.map((s) => s.exerciseName))];
  const totalSets = session.sets.length;
  const topSet = session.sets.reduce(
    (best, s) => (s.weightKg > (best?.weightKg ?? 0) ? s : best),
    session.sets[0],
  );

  return (
    <View className="mb-3 rounded-2xl border border-surface-border bg-surface-card p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-white">{session.name}</Text>
          <Text className="mt-0.5 text-xs text-zinc-500">
            {totalSets} sets · {exercises.length} exercises · {duration}
          </Text>
        </View>
        <View className="rounded-lg bg-brand-400/15 px-2.5 py-1">
          <Text className="text-xs font-medium text-brand-400">Done</Text>
        </View>
      </View>
      {topSet && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {exercises.slice(0, 3).map((ex) => (
            <View key={ex} className="rounded-lg bg-surface-border px-2.5 py-1">
              <Text className="text-xs text-zinc-400">{ex}</Text>
            </View>
          ))}
          {exercises.length > 3 && (
            <View className="rounded-lg bg-surface-border px-2.5 py-1">
              <Text className="text-xs text-zinc-400">+{exercises.length - 3} more</Text>
            </View>
          )}
          <View className="rounded-lg bg-surface-border px-2.5 py-1">
            <Text className="text-xs text-zinc-400">
              Top: {displayWeight(topSet.weightKg, unitSystem)} × {topSet.reps}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const [date, setDate] = useState(new Date());
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [logSetModalVisible, setLogSetModalVisible] = useState(false);

  const { sessions, activeSessionId, startSession, addSet, endSession, cancelSession } =
    useFitLog();

  const dateKey = toDateKey(date);
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const daySessions = sessions.filter((s) => s.date === dateKey && s.id !== activeSessionId);

  const nextSetNumber = activeSession
    ? (activeSession.sets.filter((s) => s.exerciseName === '').length || 0) + 1
    : 1;

  function handleAddSet(exercise: string, weightKg: number, reps: number) {
    if (!activeSession) return;
    const sameExerciseSets = activeSession.sets.filter((s) => s.exerciseName === exercise).length;
    addSet(activeSession.id, {
      exerciseName: exercise,
      setNumber: sameExerciseSets + 1,
      weightKg,
      reps,
    });
  }

  // If there's an active session, show the active view
  if (activeSession) {
    return (
      <>
        <ActiveSessionView
          session={activeSession}
          onAddSet={() => setLogSetModalVisible(true)}
          onEnd={() => endSession(activeSession.id)}
          onCancel={() => cancelSession(activeSession.id)}
        />
        <LogSetModal
          visible={logSetModalVisible}
          onClose={() => setLogSetModalVisible(false)}
          onLog={handleAddSet}
          nextSetNumber={nextSetNumber}
        />
      </>
    );
  }

  return (
    <SafeAreaView className="bg-surface-DEFAULT flex-1">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-white">Workout</Text>
          <TouchableOpacity
            onPress={() => setStartModalVisible(true)}
            className="rounded-xl bg-brand-400 px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">Start session</Text>
          </TouchableOpacity>
        </View>

        <DateNav
          date={date}
          onPrev={() => setDate(prevDay(date))}
          onNext={() => setDate(nextDay(date))}
        />

        {/* Today's sessions */}
        {daySessions.length > 0 && (
          <>
            <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Today&apos;s sessions
            </Text>
            {daySessions.map((sess) => (
              <SessionCard key={sess.id} session={sess} />
            ))}
          </>
        )}

        {/* Starter routines */}
        <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
          Starter routines
        </Text>
        {STARTER_ROUTINES.map((r) => (
          <TouchableOpacity
            key={r.name}
            onPress={() => {
              startSession(r.name);
            }}
            className="mb-3 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4"
          >
            <View>
              <Text className="font-medium text-white">{r.name}</Text>
              <Text className="mt-0.5 text-xs text-zinc-500">{r.days}</Text>
            </View>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor:
                  r.tag === 'bulk'
                    ? 'rgba(245,158,11,0.15)'
                    : r.tag === 'cut'
                      ? 'rgba(239,68,68,0.15)'
                      : 'rgba(59,130,246,0.15)',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: r.tag === 'bulk' ? '#f59e0b' : r.tag === 'cut' ? '#ef4444' : '#3b82f6',
                }}
              >
                {r.tag}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      <StartSessionModal
        visible={startModalVisible}
        onClose={() => setStartModalVisible(false)}
        onStart={startSession}
      />
    </SafeAreaView>
  );
}
