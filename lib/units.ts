export type UnitSystem = 'metric' | 'imperial';

const KG_PER_LB = 0.453592;
const CM_PER_IN = 2.54;

function fmt(n: number, dp: number): string {
  if (!isFinite(n)) return '';
  return parseFloat(n.toFixed(dp)).toString();
}

/** kg string → lbs string (1 decimal place). Returns '' if input is empty or NaN. */
export function kgToLbs(kg: string): string {
  const n = parseFloat(kg);
  return isNaN(n) ? '' : fmt(n / KG_PER_LB, 1);
}

/** lbs string → kg string (2 decimal places). Returns '' if input is empty or NaN. */
export function lbsToKg(lbs: string): string {
  const n = parseFloat(lbs);
  return isNaN(n) ? '' : fmt(n * KG_PER_LB, 2);
}

/** cm string → inches string (1 decimal place). Returns '' if input is empty or NaN. */
export function cmToIn(cm: string): string {
  const n = parseFloat(cm);
  return isNaN(n) ? '' : fmt(n / CM_PER_IN, 1);
}

/** inches string → cm string (1 decimal place). Returns '' if input is empty or NaN. */
export function inToCm(inches: string): string {
  const n = parseFloat(inches);
  return isNaN(n) ? '' : fmt(n * CM_PER_IN, 1);
}

/** Returns weight in kg regardless of unit system. */
export function toMetricWeight(val: string, unit: UnitSystem): number {
  const n = parseFloat(val);
  return unit === 'imperial' ? n * KG_PER_LB : n;
}

/** Returns height in cm regardless of unit system. */
export function toMetricHeight(val: string, unit: UnitSystem): number {
  const n = parseFloat(val);
  return unit === 'imperial' ? n * CM_PER_IN : n;
}

export const WEIGHT_BOUNDS: Record<UnitSystem, { max: number }> = {
  metric: { max: 500 },
  imperial: { max: 1102 },
};

export const HEIGHT_BOUNDS: Record<UnitSystem, { max: number }> = {
  metric: { max: 300 },
  imperial: { max: 118 },
};
