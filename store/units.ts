import { create } from 'zustand';

import type { UnitSystem } from '@/lib/units';

const STORAGE_KEY = 'fitapp_unit_system';

interface UnitsState {
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
}

/** Read persisted preference at startup (defaults to 'metric' if absent/invalid). */
function loadUnitSystem(): UnitSystem {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return stored === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

/**
 * Global unit-system preference store.
 * Persists to localStorage so the preference survives page reloads.
 * All weights are stored in kg in fitlog; this store controls display only.
 */
export const useUnitsStore = create<UnitsState>((set) => ({
  unitSystem: loadUnitSystem(),
  setUnitSystem: (unitSystem) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, unitSystem);
      }
    } catch {}
    set({ unitSystem });
  },
}));
