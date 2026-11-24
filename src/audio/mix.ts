/**
 * Pure audio helpers (no Howler / WebAudio): playlist order, crossfade scheduling, pitch and
 * gain mapping. Unit-tested in tests/unit/audio/.
 */
import type { LineId } from '../data/schema';

export type MusicTrack = 'music_main' | 'music_l1' | 'music_l2' | 'music_l3' | 'music_depot' | 'music_ending';
export type AmbTrack = 'amb_l1' | 'amb_l2' | 'amb_l3';
export type AudioScene = { kind: 'line'; line: LineId } | { kind: 'depot' } | { kind: 'ending' };

/** Crossfade between scenes (Line ↔ Line, Line ↔ Depot), seconds. */
export const SCENE_FADE_S = 2;
/** Ambience loop crossfade (amb_l1 builds up over its length: ≥ 3 s, docs/art/AUDIO.md). */
export const AMB_FADE_S: Record<AmbTrack, number> = { amb_l1: 3.5, amb_l2: 2.5, amb_l3: 2.5 };
/** Ducking depth while the ending runs / the whale sings. */
export const DUCK_DB = -9;
/** Mix (AUDIO.md mix notes): music ≈ 0.5, ambience ≈ 0.7 before the settings volume. */
export const MUSIC_BASE = 0.5;
export const AMB_BASE = 0.7;

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

/** Equal-power crossfade gains for progress u ∈ [0,1]: `out` falls, `in` rises, out²+in² = 1. */
export function equalPower(u: number): { out: number; in: number } {
  const x = u < 0 ? 0 : u > 1 ? 1 : u;
  return { out: Math.cos((x * Math.PI) / 2), in: Math.sin((x * Math.PI) / 2) };
}

/**
 * Track order for a scene. A Line alternates the main theme and its variant, starting on the
 * variant (the main theme already plays on the title); Depot and ending are single loops.
 */
export function playlistFor(scene: AudioScene): MusicTrack[] {
  if (scene.kind === 'depot') return ['music_depot'];
  if (scene.kind === 'ending') return ['music_ending'];
  return [`music_l${scene.line}` as MusicTrack, 'music_main'];
}

export function ambienceFor(scene: AudioScene): AmbTrack | null {
  return scene.kind === 'line' ? (`amb_l${scene.line}` as AmbTrack) : null;
}

/** Index of the next track in a playlist (wraps). */
export const nextIndex = (list: readonly unknown[], i: number): number => (list.length ? (i + 1) % list.length : 0);

export const sameScene = (a: AudioScene | null, b: AudioScene): boolean =>
  !!a && a.kind === b.kind && (a.kind !== 'line' || (b.kind === 'line' && a.line === b.line));

/**
 * Seamless loop with a self-crossfade: a layer that started at `start` (seconds) with length
 * `dur` must launch its successor at `start + dur − fade`, so the successor reaches full gain
 * exactly when the current one ends. Returns the successor start time.
 */
export function nextLoopStart(start: number, dur: number, fade: number): number {
  const f = Math.max(0, Math.min(fade, dur / 2));
  return start + dur - f;
}

/** Plan the first `n` loop-layer start times (helper for tests/debug). */
export function loopSchedule(start: number, dur: number, fade: number, n: number): number[] {
  const out: number[] = [];
  let t = start;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t = nextLoopStart(t, dur, fade);
  }
  return out;
}

/**
 * Coin chime pitch: a semitone offset rising with log10(amount), capped at two octaves.
 * 1 Shell → 0, 10 → +2, 1K → +6, 1M → +12, 1e12 → +24 (cap).
 */
export function coinSemitones(amount: number): number {
  if (!(amount > 1)) return 0;
  return Math.min(24, 2 * Math.log10(amount));
}

export const semitoneRatio = (st: number): number => Math.pow(2, st / 12);

/** Wheel clack interval (s) from train speed (world units/s); null = silent (stopped). */
export function clackInterval(speed: number, wheelbase = 1.2): number | null {
  const v = Math.abs(speed);
  if (v < 0.05) return null;
  return Math.max(0.09, Math.min(1.5, wheelbase / v));
}
