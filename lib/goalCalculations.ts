import type { GoalMode } from '@/store/auth';

import type { UnitSystem } from './units';
import { lbsToKg } from './units';

interface PresetDateResult {
  slow: string; // ISO date string
  normal: string;
  fast: string;
}

/** Calculate target date based on weight difference and pace (weekly change). */
function calculateTargetDate(
  currentWeightKg: number,
  goalWeightKg: number,
  weeklyChangeKg: number,
): Date {
  const diffKg = Math.abs(goalWeightKg - currentWeightKg);
  const weeksNeeded = Math.ceil(diffKg / Math.abs(weeklyChangeKg));
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + weeksNeeded * 7);
  return targetDate;
}

/** Get preset target dates for a cutting goal. */
function getCuttingDates(currentWeightKg: number, goalWeightKg: number): PresetDateResult {
  return {
    slow: calculateTargetDate(currentWeightKg, goalWeightKg, 0.25).toISOString(),
    normal: calculateTargetDate(currentWeightKg, goalWeightKg, 0.5).toISOString(),
    fast: calculateTargetDate(currentWeightKg, goalWeightKg, 1).toISOString(),
  };
}

/** Get preset target dates for a bulking goal. */
function getBulkingDates(currentWeightKg: number, goalWeightKg: number): PresetDateResult {
  return {
    slow: calculateTargetDate(currentWeightKg, goalWeightKg, 0.25).toISOString(),
    normal: calculateTargetDate(currentWeightKg, goalWeightKg, 0.5).toISOString(),
    fast: calculateTargetDate(currentWeightKg, goalWeightKg, 1).toISOString(),
  };
}

/** Get preset target dates for maintenance (fixed days from today). */
function getMaintenanceDates(): PresetDateResult {
  const today = new Date();
  const slow = new Date(today);
  slow.setDate(slow.getDate() + 90);

  const normal = new Date(today);
  normal.setDate(normal.getDate() + 60);

  const fast = new Date(today);
  fast.setDate(fast.getDate() + 30);

  return {
    slow: slow.toISOString(),
    normal: normal.toISOString(),
    fast: fast.toISOString(),
  };
}

/**
 * Calculate preset dates based on goal mode and weight difference.
 * Respects the unit system by converting input weight to kg for calculation.
 */
export function getPresetDates(
  currentWeight: number,
  goalWeight: number,
  goalMode: GoalMode,
  unitSystem: UnitSystem,
): PresetDateResult {
  // Convert to kg if imperial
  const currentWeightKg =
    unitSystem === 'imperial' ? parseFloat(lbsToKg(currentWeight.toString())) : currentWeight;
  const goalWeightKg =
    unitSystem === 'imperial' ? parseFloat(lbsToKg(goalWeight.toString())) : goalWeight;

  if (goalMode === 'cut') {
    return getCuttingDates(currentWeightKg, goalWeightKg);
  }
  if (goalMode === 'bulk') {
    return getBulkingDates(currentWeightKg, goalWeightKg);
  }
  return getMaintenanceDates();
}

/** Format ISO date string to readable date (e.g., "May 15, 2026"). */
export function formatTargetDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// ─── Goal status ──────────────────────────────────────────────────────────────

export type GoalStatus = 'reached' | 'missed' | 'ahead' | 'on_track' | 'no_goal';

/**
 * Derive the dynamic goal status from current data.
 * "ahead" = required remaining pace is <80% of normal (0.5 kg/week).
 */
export function getGoalStatus(
  currentWeightKg: number | null,
  goalWeightKg: number | null,
  goalTargetDate: string | null,
  goalMode: GoalMode | null,
): GoalStatus {
  if (!currentWeightKg || !goalWeightKg || !goalMode) return 'no_goal';

  const isCut = goalMode === 'cut';
  const isBulk = goalMode === 'bulk';

  // Reached?
  if (isCut && currentWeightKg <= goalWeightKg + 0.5) return 'reached';
  if (isBulk && currentWeightKg >= goalWeightKg - 0.5) return 'reached';
  if (goalMode === 'maintenance' && Math.abs(currentWeightKg - goalWeightKg) < 1) return 'reached';

  if (!goalTargetDate) return 'on_track';

  const now = Date.now();
  const targetMs = new Date(goalTargetDate).getTime();

  // Missed?
  if (targetMs < now) return 'missed';

  // Ahead of pace? (required pace < 80% of normal 0.5 kg/week)
  const daysRemaining = (targetMs - now) / 86_400_000;
  const remaining = Math.abs(currentWeightKg - goalWeightKg);
  const requiredPerDay = remaining / Math.max(daysRemaining, 1);
  const normalPerDay = 0.5 / 7;
  if (requiredPerDay < normalPerDay * 0.8) return 'ahead';

  return 'on_track';
}

export const GOAL_STATUS_META: Record<
  GoalStatus,
  { label: string; bg: string; color: string } | null
> = {
  reached: { label: '🎯 Goal reached', bg: 'rgba(26,158,110,0.15)', color: '#1a9e6e' },
  missed: { label: '⚠ Goal missed', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  ahead: { label: '⚡ Ahead of pace', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  on_track: { label: '✓ On track', bg: 'rgba(26,158,110,0.15)', color: '#1a9e6e' },
  no_goal: null,
};

/** Get human-readable pace label based on goal mode and weeks. */
export function getPaceLabel(
  currentWeight: number,
  goalWeight: number,
  goalMode: GoalMode,
  unitSystem: UnitSystem,
  pace: 'slow' | 'normal' | 'fast',
): string {
  if (goalMode === 'maintenance') {
    const days = pace === 'slow' ? 90 : pace === 'normal' ? 60 : 30;
    return `+${days} days`;
  }

  const currentWeightKg =
    unitSystem === 'imperial' ? parseFloat(lbsToKg(currentWeight.toString())) : currentWeight;
  const goalWeightKg =
    unitSystem === 'imperial' ? parseFloat(lbsToKg(goalWeight.toString())) : goalWeight;
  const diffKg = Math.abs(goalWeightKg - currentWeightKg);

  const weeklyChange = pace === 'slow' ? 0.25 : pace === 'normal' ? 0.5 : 1;
  const weeksNeeded = Math.ceil(diffKg / weeklyChange);

  return `${weeklyChange} kg/week · ~${weeksNeeded}w`;
}
