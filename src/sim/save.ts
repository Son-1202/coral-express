// Save versioning + migration. Bump SAVE_VERSION in types.ts and add a step here.
// Anything unreadable becomes a fresh game; missing fields are filled from defaults.
import { blankState } from './state';
import { SAVE_VERSION, type SaveData, type SimState } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Recursively add keys missing from `target` (or of the wrong kind) using `def`. */
function fillDefaults(target: Obj, def: Obj): void {
  for (const [k, d] of Object.entries(def)) {
    const v = target[k];
    if (d === null) { if (v === undefined) target[k] = null; continue; }
    const wrong = v === undefined || v === null
      || (Array.isArray(d) ? !Array.isArray(v) : typeof v !== typeof d || (isObj(d) && !isObj(v)));
    if (wrong) target[k] = JSON.parse(JSON.stringify(d)) as unknown;
    else if (isObj(d) && isObj(v)) fillDefaults(v, d);
  }
}

/** v0 (pre-release) kept Tickets / upgrades / stamps at the top level of the state. */
function migrateV0(state: Obj): void {
  const perm: Obj = isObj(state['permanent']) ? state['permanent'] : {};
  for (const k of ['tickets', 'totalTicketsEarned', 'upgrades', 'stamps', 'postcards', 'openedLines']) {
    if (state[k] !== undefined && perm[k] === undefined) perm[k] = state[k];
    delete state[k];
  }
  state['permanent'] = perm;
}

function fresh(seed: number): SaveData {
  return { version: SAVE_VERSION, savedAt: null, state: blankState(seed) };
}

/**
 * Accepts a SaveData object, a JSON string of one, or a bare v0 state. Invalid input
 * (bad JSON, not an object, no state) → fresh game (blank state; createSim starts a run).
 * A save from a newer version throws (never silently overwrite newer progress).
 */
export function migrateSave(raw: unknown, seed = 0): SaveData {
  let v: unknown = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v) as unknown; } catch { return fresh(seed); }
  }
  if (!isObj(v)) return fresh(seed);
  const copy = JSON.parse(JSON.stringify(v)) as Obj;
  // Bare v0 state (no wrapper).
  const wrapped = isObj(copy['state']) ? copy : 'shells' in copy ? { version: 0, savedAt: null, state: copy } : null;
  if (!wrapped || !isObj(wrapped['state'])) return fresh(seed);
  const version = typeof wrapped['version'] === 'number' ? wrapped['version'] : 0;
  if (version > SAVE_VERSION) throw new Error(`sim: save version ${version} is newer than ${SAVE_VERSION}`);
  const state = wrapped['state'] as Obj;
  if (version < 1) migrateV0(state);
  fillDefaults(state, blankState(seed) as unknown as Obj);
  state['version'] = SAVE_VERSION;
  const savedAt = typeof wrapped['savedAt'] === 'number' ? wrapped['savedAt'] : null;
  return { version: SAVE_VERSION, savedAt, state: state as unknown as SimState };
}
