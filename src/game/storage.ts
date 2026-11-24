import type { SaveData } from '../sim';
import { DEFAULT_SETTINGS, type Settings } from './bus';

/** localStorage keys (persistence is localStorage only, SPEC C). */
export const SAVE_KEY = 'coral-express.save';
export const SETTINGS_KEY = 'coral-express.settings';

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Raw parsed save or null. The sim validates/migrates it (invalid → fresh game). */
export function readSave(): unknown {
  const raw = ls()?.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveData): boolean {
  try {
    ls()?.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (err) {
    console.warn('[save] could not write save', err);
    return false;
  }
}

export function clearSave(): void {
  ls()?.removeItem(SAVE_KEY);
}

export function readSettings(): Settings {
  try {
    const raw = ls()?.getItem(SETTINGS_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return { ...DEFAULT_SETTINGS, ...p };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(s: Settings): void {
  try {
    ls()?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
