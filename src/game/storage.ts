import { migrateSave, SAVE_VERSION, type SaveData, type SimState } from '../sim';
import { DEFAULT_SETTINGS, type Settings } from './bus';

/** localStorage keys (persistence is localStorage only, SPEC C). */
export const SAVE_KEY = 'coral-express.save';
export const SETTINGS_KEY = 'coral-express.settings';
/** T-36: the save that an import replaced (best-effort safety copy). */
export const BACKUP_KEY = 'coral-express.save.backup';

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

/** The stored save string exactly as it is (null if none / no storage). */
export function readSaveRaw(): string | null {
  try {
    return ls()?.getItem(SAVE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * T-36 import: back the current save up, write `save`, read it back. Returns false (and
 * leaves the previous save in place) when storage is missing, full or does not keep it.
 */
export function replaceSave(save: SaveData): boolean {
  const store = ls();
  if (!store) return false;
  const json = JSON.stringify(save);
  let prev: string | null = null;
  try {
    prev = store.getItem(SAVE_KEY);
    if (prev !== null) store.setItem(BACKUP_KEY, prev);
  } catch {
    /* the backup is best effort */
  }
  const put = (): boolean => {
    try {
      store.setItem(SAVE_KEY, json);
      return true;
    } catch {
      return false;
    }
  };
  if (!put()) {
    // quota: drop the backup copy and try once more (a failed setItem keeps the old value)
    try {
      store.removeItem(BACKUP_KEY);
    } catch {
      /* ignore */
    }
    if (!put()) return false;
  }
  let back: string | null = null;
  try {
    back = store.getItem(SAVE_KEY);
  } catch {
    back = null;
  }
  if (back === json) return true;
  try {
    if (prev !== null) store.setItem(SAVE_KEY, prev);
  } catch {
    /* ignore */
  }
  return false;
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

// ---------------- T-36: save codes (export / import) ----------------

/** Format of the code wrapper `{v, savedAt, data}` (not the sim's SAVE_VERSION). */
export const SAVE_CODE_VERSION = 1;
/** Codes longer than this are refused before decoding (a real save is far smaller). */
export const MAX_CODE_CHARS = 8_000_000;

export interface SavePreview {
  tickets: number;
  totalTicketsEarned: number;
  openedLines: number[];
  shells: number;
  currentLine: number;
  stamps: number;
  postcards: number;
  carriages: number;
  savedAt: number | null;
}

export type DecodeResult = { ok: true; save: SaveData } | { ok: false; error: string };

export const CODE_ERRORS = {
  empty: 'Paste a save code first.',
  prefix: 'That doesn’t look like a Coral Express save code (it starts with “CE1.”).',
  damaged: 'This save code is incomplete or damaged. Copy the whole code again and paste it here.',
  newer: 'This save code comes from a newer version of Coral Express. Reload the game to update, then try again.',
  noGzip: 'This browser can’t open compressed save codes. Try the save file, or update the browser.',
  notSave: 'This code doesn’t contain a Coral Express trip.',
  tooBig: 'That is far too long to be a save code.',
} as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export function savePreviewOf(state: SimState, savedAt: number | null): SavePreview {
  const p = state.permanent;
  return {
    tickets: p.tickets,
    totalTicketsEarned: p.totalTicketsEarned,
    openedLines: [...p.openedLines],
    shells: state.shells,
    currentLine: state.currentLine,
    stamps: p.stamps.length,
    postcards: p.postcards.length,
    carriages: state.carriages.length,
    savedAt,
  };
}

/** `coral-express-save-YYYYMMDD.txt` (local date). */
export function saveFileName(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `coral-express-save-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}.txt`;
}

function bytesToB64url(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array | null {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]+$/.test(t) || t.length % 4 === 1) return null;
  try {
    const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function through(bytes: Uint8Array, ts: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(ts);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const canGzip = (): boolean => typeof CompressionStream === 'function';
const canGunzip = (): boolean => typeof DecompressionStream === 'function';

/**
 * Save → `CE1.<base64url(gzip(json))>` (or `CE0.<base64url(json)>` without CompressionStream
 * or with `compress: false`). The JSON is `{v, savedAt, data}`.
 */
export async function encodeSaveCode(save: SaveData, opts: { compress?: boolean } = {}): Promise<string> {
  const json = JSON.stringify({ v: SAVE_CODE_VERSION, savedAt: save.savedAt, data: save });
  const raw = new TextEncoder().encode(json);
  if (opts.compress !== false && canGzip()) {
    try {
      const gz = await through(raw, new CompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>);
      return `CE1.${bytesToB64url(gz)}`;
    } catch {
      /* fall through to uncompressed */
    }
  }
  return `CE0.${bytesToB64url(raw)}`;
}

/** Shape check *before* migrateSave (which would turn junk into a blank game). */
function checkShape(data: unknown): DecodeResult | null {
  if (!isObj(data) || !isObj(data['state'])) return { ok: false, error: CODE_ERRORS.notSave };
  const ver = data['version'];
  if (typeof ver !== 'number' || !Number.isFinite(ver) || ver < 0) return { ok: false, error: CODE_ERRORS.notSave };
  if (ver > SAVE_VERSION) return { ok: false, error: CODE_ERRORS.newer };
  const st = data['state'];
  const cars = st['carriages'];
  if (!Array.isArray(cars) || cars.length === 0) return { ok: false, error: CODE_ERRORS.notSave };
  if (typeof st['shells'] !== 'number') return { ok: false, error: CODE_ERRORS.notSave };
  const perm = ver >= 1 ? st['permanent'] : isObj(st['permanent']) ? st['permanent'] : st;
  if (!isObj(perm) || typeof perm['tickets'] !== 'number' || !Array.isArray(perm['openedLines'])) {
    return { ok: false, error: CODE_ERRORS.notSave };
  }
  return null;
}

/**
 * Code → migrated SaveData, or a friendly error. Never touches storage. Whitespace and
 * surrounding quotes from copy/paste are ignored.
 */
export async function decodeSaveCode(code: string): Promise<DecodeResult> {
  if (code.length > MAX_CODE_CHARS) return { ok: false, error: CODE_ERRORS.tooBig };
  const text = code.replace(/\s+/g, '').replace(/^["'`]+|["'`]+$/g, '');
  if (!text) return { ok: false, error: CODE_ERRORS.empty };
  const m = /^CE(\d+)\.(.*)$/i.exec(text);
  if (!m) return { ok: false, error: CODE_ERRORS.prefix };
  const kind = Number(m[1]);
  if (kind > 1) return { ok: false, error: CODE_ERRORS.newer };
  const bytes = b64urlToBytes(m[2] ?? '');
  if (!bytes || bytes.length === 0) return { ok: false, error: CODE_ERRORS.damaged };
  let raw = bytes;
  if (kind === 1) {
    if (!canGunzip()) return { ok: false, error: CODE_ERRORS.noGzip };
    try {
      raw = await through(bytes, new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>);
    } catch {
      return { ok: false, error: CODE_ERRORS.damaged };
    }
  }
  let wrapper: unknown;
  try {
    wrapper = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) as unknown;
  } catch {
    return { ok: false, error: CODE_ERRORS.damaged };
  }
  if (!isObj(wrapper) || typeof wrapper['v'] !== 'number') return { ok: false, error: CODE_ERRORS.notSave };
  if (wrapper['v'] > SAVE_CODE_VERSION) return { ok: false, error: CODE_ERRORS.newer };
  const data = wrapper['data'];
  const bad = checkShape(data);
  if (bad) return bad;
  try {
    return { ok: true, save: migrateSave(data) };
  } catch {
    return { ok: false, error: CODE_ERRORS.newer };
  }
}
