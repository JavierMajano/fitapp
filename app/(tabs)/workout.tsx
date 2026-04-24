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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateNav } from '@/components/DateNav';
import { trpc } from '@/lib/trpc';
import { displayWeight, toMetricWeight } from '@/lib/units';
import { useToastStore } from '@/store/toast';
import { useUnitsStore } from '@/store/units';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Elapsed timer hook ───────────────────────────────────────────────────────

function useElapsed(startedAt: Date | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Date.now() - startedAt.getTime());
    tick();
    ref.current = setInterval(tick, 1000);
    return () => {
      if (ref.current !== null) clearInterval(ref.current);
    };
  }, [startedAt]);

  return elapsed;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveSet {
  id: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
}

interface ActiveSession {
  id: string;
  name: string;
  startedAt: Date;
  sets: ActiveSet[];
}

// ─── Start session modal ──────────────────────────────────────────────────────

interface StartSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onStart: (name: string, routineId?: string) => void;
  routines: { id: string; name: string; description: string | null; daysPerWeek: number }[];
  isPending: boolean;
}

function StartSessionModal({
  visible,
  onClose,
  onStart,
  routines,
  isPending,
}: StartSessionModalProps) {
  const [name, setName] = useState('');

  function handleStart(sessionName: string, routineId?: string) {
    if (!sessionName.trim()) return;
    onStart(sessionName.trim(), routineId);
    setName('');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
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
                testID="start-empty-session-btn"
                onPress={() => handleStart(name || 'Ad-hoc session')}
                disabled={isPending}
                className="mb-4 items-center rounded-2xl bg-brand-400 py-4"
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-base font-semibold text-white">Start Empty Session</Text>
                )}
              </TouchableOpacity>

              {routines.length > 0 && (
                <>
                  <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
                    or pick a routine
                  </Text>
                  {routines.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      testID={`routine-btn-${r.id}`}
                      onPress={() => handleStart(r.name, r.id)}
                      disabled={isPending}
                      className="mb-2 flex-row items-center justify-between rounded-2xl border border-surface-border p-4"
                    >
                      <View>
                        <Text className="font-medium text-white">{r.name}</Text>
                        <Text className="text-xs text-zinc-500">{r.daysPerWeek}-day split</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
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

// ─── Log set modal ────────────────────────────────────────────────────────────

interface LogSetModalProps {
  visible: boolean;
  onClose: () => void;
  onLog: (exerciseName: string, weightKg: number | null, reps: number | null) => void;
  nextSetNumber: number;
  exercises: { id: string; name: string; category: string }[];
  isPending: boolean;
}

function LogSetModal({
  visible,
  onClose,
  onLog,
  nextSetNumber,
  exercises,
  isPending,
}: LogSetModalProps) {
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [step, setStep] = useState<'exercise' | 'details'>('exercise');

  const { unitSystem } = useUnitsStore();
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  const filtered = exerciseQuery
    ? exercises.filter((e) => e.name.toLowerCase().includes(exerciseQuery.toLowerCase()))
    : exercises;

  function handleLog() {
    if (!selectedExercise) return;
    const rawWeight = parseFloat(weight);
    const weightKg = isNaN(rawWeight) ? null : toMetricWeight(String(rawWeight), unitSystem);
    const parsedReps = parseInt(reps, 10);
    onLog(selectedExercise, weightKg, isNaN(parsedReps) ? null : parsedReps);
    resetAndClose();
  }

  function resetAndClose() {
    setExerciseQuery('');
    setSelectedExercise('');
    setWeight('');
    setReps('');
    setStep('exercise');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={resetAndClose}>
        <Pressable onPress={() => {}} style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
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
                <TouchableOpacity onPress={resetAndClose}>
                  <Text className="text-zinc-400">✕</Text>
                </TouchableOpacity>
              </View>

              {step === 'exercise' ? (
                <>
                  <TextInput
                    testID="exercise-search-input"
                    style={{ backgroundColor: '#222222', color: '#fff' }}
                    className="mb-3 rounded-xl px-4 py-3 text-white"
                    placeholder="Search exercise…"
                    placeholderTextColor="#52525b"
                    value={exerciseQuery}
                    onChangeText={setExerciseQuery}
                    autoFocus
                  />
                  <FlatList
                    data={filtered.slice(0, 30)}
                    keyExtractor={(item) => item.id}
                    style={{ maxHeight: 320 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                      <Text className="py-4 text-center text-sm text-zinc-500">
                        No exercises found
                      </Text>
                    }
                    renderItem={({ item, index }) => (
                      <TouchableOpacity
                        testID={`exercise-result-${index}`}
                        onPress={() => {
                          setSelectedExercise(item.name);
                          setStep('details');
                        }}
                        className="border-b border-surface-border py-3.5"
                      >
                        <Text className="text-sm text-white">{item.name}</Text>
                        <Text className="text-xs text-zinc-500">{item.category}</Text>
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
                    testID="log-set-submit-btn"
                    onPress={handleLog}
                    disabled={isPending}
                    className="items-center rounded-2xl bg-brand-400 py-4"
                  >
                    {isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-base font-semibold text-white">
                        Log Set · {weight || '0'} {unitLabel} × {reps || '0'} reps
                      </Text>
                    )}
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
  session: ActiveSession;
  onAddSet: () => void;
  onEnd: () => void;
  onCancel: () => void;
  isEnding: boolean;
}

function ActiveSessionView({
  session,
  onAddSet,
  onEnd,
  onCancel,
  isEnding,
}: ActiveSessionViewProps) {
  const elapsed = useElapsed(session.startedAt);
  const { unitSystem } = useUnitsStore();
  const colHeader = unitSystem === 'metric' ? 'KG' : 'LBS';

  // Group sets by exercise name
  const grouped = session.sets.reduce<Record<string, ActiveSet[]>>((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = [];
    acc[s.exerciseName]!.push(s);
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
              testID="cancel-session-btn"
              onPress={onCancel}
              className="rounded-xl border border-surface-border px-3 py-2"
            >
              <Text className="text-sm text-zinc-400">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="finish-session-btn"
              onPress={onEnd}
              disabled={isEnding}
              className="rounded-xl bg-brand-400 px-3 py-2"
            >
              {isEnding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-sm font-semibold text-white">Finish</Text>
              )}
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
                    {s.weightKg != null ? displayWeight(s.weightKg, unitSystem) : '—'}
                  </Text>
                  <Text className="w-16 text-right text-sm font-medium text-white">
                    {s.reps ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}

        <TouchableOpacity
          testID="add-set-btn"
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

// ─── Past session card ────────────────────────────────────────────────────────

interface DbSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
}

interface DbSession {
  id: string;
  name: string;
  startedAt: Date | string; // tRPC serializes Dates as ISO strings over HTTP
  endedAt: Date | string | null;
  sets: DbSet[];
}

function SessionCard({ session }: { session: DbSession }) {
  const { unitSystem } = useUnitsStore();
  const startTs = new Date(session.startedAt).getTime();
  const endTs = session.endedAt ? new Date(session.endedAt).getTime() : null;
  const durationMs = endTs ? endTs - startTs : 0;
  const duration = endTs ? formatDuration(durationMs) : 'in progress';
  const totalSets = session.sets.length;
  const topWeight = Math.max(...session.sets.map((s) => s.weightKg ?? 0), 0);

  return (
    <View
      testID={`session-card-${session.id}`}
      className="mb-3 rounded-2xl border border-surface-border bg-surface-card p-4"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-white">{session.name}</Text>
          <Text className="mt-0.5 text-xs text-zinc-500">
            {totalSets} sets · {duration}
          </Text>
        </View>
        <View className="rounded-lg bg-brand-400/15 px-2.5 py-1">
          <Text className="text-xs font-medium text-brand-400">Done</Text>
        </View>
      </View>
      {topWeight > 0 && (
        <Text className="mt-2 text-xs text-zinc-500">
          Top weight: {displayWeight(topWeight, unitSystem)}
        </Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const [date, setDate] = useState(new Date());
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [logSetModalVisible, setLogSetModalVisible] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  const showError = useToastStore((s) => s.showError);
  const dateKey = toDateKey(date);
  const utils = trpc.useUtils();

  const routinesQuery = trpc.workout.listRoutines.useQuery(undefined, { staleTime: 300_000 });
  const exercisesQuery = trpc.workout.listExercises.useQuery(undefined, { staleTime: 300_000 });
  const sessionsQuery = trpc.workout.getSessionsByDate.useQuery(
    { date: dateKey },
    { staleTime: 30_000 },
  );

  const startSessionMut = trpc.workout.startSession.useMutation({
    onSuccess: (data) => {
      setActiveSession({
        id: data.id,
        name: data.name,
        startedAt: new Date(data.startedAt),
        sets: [],
      });
      setStartModalVisible(false);
    },
    onError: (err) => showError(err.message),
  });

  const logSetMut = trpc.workout.logSet.useMutation({
    onSuccess: (data, vars) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sets: [
            ...prev.sets,
            {
              id: data.id,
              exerciseName: vars.exerciseName,
              setNumber: vars.setNumber,
              weightKg: data.weightKg,
              reps: data.reps,
            },
          ],
        };
      });
    },
    onError: (err) => showError(err.message),
  });

  const endSessionMut = trpc.workout.endSession.useMutation({
    onSuccess: () => {
      setActiveSession(null);
      utils.workout.getSessionsByDate.invalidate({ date: dateKey });
    },
    onError: (err) => showError(err.message),
  });

  const routines = routinesQuery.data ?? [];
  const exercises = exercisesQuery.data ?? [];
  const pastSessions = (sessionsQuery.data ?? []) as unknown as DbSession[];

  const nextSetNumber = activeSession
    ? (activeSession.sets.filter(
        (s) =>
          s.exerciseName ===
          (activeSession.sets[activeSession.sets.length - 1]?.exerciseName ?? ''),
      ).length || 0) + 1
    : 1;

  function handleAddSet(exerciseName: string, weightKg: number | null, reps: number | null) {
    if (!activeSession) return;
    const sameEx = activeSession.sets.filter((s) => s.exerciseName === exerciseName).length;
    logSetMut.mutate({
      sessionId: activeSession.id,
      exerciseName,
      setNumber: sameEx + 1,
      ...(weightKg != null ? { weightKg } : {}),
      ...(reps != null ? { reps } : {}),
    });
  }

  // Active session view
  if (activeSession) {
    return (
      <>
        <ActiveSessionView
          session={activeSession}
          onAddSet={() => setLogSetModalVisible(true)}
          onEnd={() => endSessionMut.mutate({ sessionId: activeSession.id })}
          onCancel={() => setActiveSession(null)}
          isEnding={endSessionMut.isPending}
        />
        <LogSetModal
          visible={logSetModalVisible}
          onClose={() => setLogSetModalVisible(false)}
          onLog={handleAddSet}
          nextSetNumber={nextSetNumber}
          exercises={exercises}
          isPending={logSetMut.isPending}
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
            testID="start-session-btn"
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

        {/* Past sessions for date */}
        {sessionsQuery.isFetching ? (
          <View className="items-center py-4">
            <ActivityIndicator color="#1a9e6e" />
          </View>
        ) : (
          pastSessions.length > 0 && (
            <>
              <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Sessions
              </Text>
              {pastSessions.map((sess) => (
                <SessionCard key={sess.id} session={sess} />
              ))}
            </>
          )
        )}

        {/* Routines */}
        <Text className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
          {routines.length > 0 ? 'Routines' : 'Starter routines'}
        </Text>

        {routinesQuery.isFetching ? (
          <View className="items-center py-4">
            <ActivityIndicator color="#1a9e6e" />
          </View>
        ) : routines.length > 0 ? (
          routines.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => startSessionMut.mutate({ name: r.name, routineId: r.id })}
              className="mb-3 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4"
            >
              <View>
                <Text className="font-medium text-white">{r.name}</Text>
                <Text className="mt-0.5 text-xs text-zinc-500">{r.daysPerWeek}-day split</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <>
            {[
              { name: 'Push / Pull / Legs', days: 6 },
              { name: 'Upper / Lower', days: 4 },
              { name: 'Full Body', days: 3 },
            ].map((r) => (
              <TouchableOpacity
                key={r.name}
                onPress={() => startSessionMut.mutate({ name: r.name })}
                className="mb-3 flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4"
              >
                <View>
                  <Text className="font-medium text-white">{r.name}</Text>
                  <Text className="mt-0.5 text-xs text-zinc-500">{r.days}-day split</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <StartSessionModal
        visible={startModalVisible}
        onClose={() => setStartModalVisible(false)}
        onStart={(name, routineId) => startSessionMut.mutate({ name, routineId })}
        routines={routines}
        isPending={startSessionMut.isPending}
      />
    </SafeAreaView>
  );
}
