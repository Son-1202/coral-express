/**
 * Procedural WebAudio SFX (SPEC B11). No files: every sound is synthesized from oscillators and
 * a shared noise buffer. Silent until `unlockSfx()` runs inside a user gesture.
 */
import { Howler } from 'howler';
import { clackInterval, coinSemitones, semitoneRatio } from './mix';

export type SfxName =
  | 'bubble' | 'coin' | 'splash' | 'bell' | 'clack' | 'click' | 'open' | 'close' | 'error'
  | 'fanfare' | 'sparkle' | 'gull' | 'cheer';

export interface SfxParams {
  /** Coin: Shells amount (pitch rises with log10). */
  amount?: number;
  /** Extra gain multiplier (0..1+). */
  gain?: number;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let volume = 0.8;
const lastAt = new Map<SfxName, number>();
/** Minimum spacing per sound so bursts (bulk events) don't stack into noise. */
const MIN_GAP: Partial<Record<SfxName, number>> = { coin: 0.05, bubble: 0.04, sparkle: 0.06, splash: 0.08, click: 0.03, fanfare: 0.4, bell: 0.5, cheer: 0.6, gull: 0.3 };

export function unlockSfx(): void {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const shared = (Howler as unknown as { ctx?: AudioContext }).ctx;
    ctx = shared ?? (Ctor ? new Ctor() : null);
    if (!ctx) return;
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

export function setSfxVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}

export const sfxReady = (): boolean => !!ctx && ctx.state === 'running';

// ---------- building blocks ----------
function env(c: AudioContext, t: number, peak: number, a: number, d: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return g;
}

function tone(c: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, peak: number, a: number, d: number): void {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d * 0.7);
  const g = env(c, t, peak, a, d);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + a + d + 0.05);
}

function burst(c: AudioContext, out: AudioNode, t: number, dur: number, peak: number, filter: BiquadFilterType, f0: number, f1: number, q = 1): void {
  if (!noise) return;
  const s = c.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  const bq = c.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t);
  bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = env(c, t, peak, Math.min(0.02, dur * 0.2), dur);
  s.connect(bq).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

// ---------- the sounds ----------
type Synth = (c: AudioContext, out: AudioNode, t: number, p: SfxParams) => void;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const SYNTHS: Record<SfxName, Synth> = {
  bubble(c, out, t) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const f = rnd(280, 420);
      tone(c, out, 'sine', f, f * rnd(2.2, 3), t + i * rnd(0.04, 0.07), 0.35, 0.005, 0.07);
    }
  },
  coin(c, out, t, p) {
    const r = semitoneRatio(coinSemitones(p.amount ?? 1));
    const f = 988 * r;
    tone(c, out, 'triangle', f, f, t, 0.28, 0.004, 0.3);
    tone(c, out, 'sine', f * 1.5, f * 1.5, t + 0.06, 0.2, 0.004, 0.4);
    tone(c, out, 'sine', f * 3.01, f * 3.01, t + 0.06, 0.05, 0.002, 0.2);
  },
  splash(c, out, t) {
    burst(c, out, t, 0.35, 0.4, 'bandpass', 2400, 380, 0.8);
    tone(c, out, 'sine', 520, 180, t + 0.02, 0.12, 0.01, 0.15);
  },
  bell(c, out, t) {
    for (const k of [0, 0.45]) {
      for (const [m, a] of [[1, 0.3], [2.76, 0.12], [5.4, 0.05]] as const) tone(c, out, 'sine', 880 * m, 880 * m, t + k, a, 0.003, 1.3);
    }
  },
  clack(c, out, t) {
    // "da-dum": two rail-joint knocks (the bogie's wheel pair)
    for (const k of [0, 0.11]) {
      burst(c, out, t + k, 0.05, 0.22, 'bandpass', 1800, 900, 2);
      tone(c, out, 'sine', 120, 70, t + k, 0.25, 0.003, 0.06);
    }
  },
  click(c, out, t) {
    tone(c, out, 'square', 1700, 1500, t, 0.08, 0.001, 0.03);
  },
  open(c, out, t) {
    burst(c, out, t, 0.18, 0.12, 'bandpass', 600, 2200, 1.2);
  },
  close(c, out, t) {
    burst(c, out, t, 0.16, 0.1, 'bandpass', 2000, 550, 1.2);
  },
  error(c, out, t) {
    tone(c, out, 'square', 220, 160, t, 0.08, 0.005, 0.18);
    tone(c, out, 'square', 200, 140, t + 0.12, 0.07, 0.005, 0.2);
  },
  fanfare(c, out, t) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(c, out, 'triangle', f, f, t + i * 0.09, 0.22, 0.008, i === notes.length - 1 ? 0.7 : 0.22));
    tone(c, out, 'sine', 1567.98, 1567.98, t + 0.36, 0.08, 0.01, 0.6);
  },
  sparkle(c, out, t) {
    for (let i = 0; i < 3; i++) {
      const f = rnd(2200, 4200);
      tone(c, out, 'sine', f, f * 1.05, t + i * 0.05, 0.1, 0.002, 0.12);
    }
  },
  gull(c, out, t) {
    for (const k of [0, 0.2]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1300, t + k);
      o.frequency.exponentialRampToValueAtTime(760, t + k + 0.09);
      o.frequency.exponentialRampToValueAtTime(1050, t + k + 0.16);
      const bq = c.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.value = 1400;
      bq.Q.value = 3;
      const g = env(c, t + k, 0.12, 0.01, 0.16);
      o.connect(bq).connect(g).connect(out);
      o.start(t + k);
      o.stop(t + k + 0.25);
    }
  },
  cheer(c, out, t) {
    // crowd-ish: band noise with a tremolo + a few soft rising "yay" voices
    if (noise) {
      const s = c.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      const bq = c.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.value = 1200;
      bq.Q.value = 0.7;
      const g = env(c, t, 0.18, 0.15, 0.9);
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 9;
      lg.gain.value = 0.06;
      lfo.connect(lg).connect(g.gain);
      s.connect(bq).connect(g).connect(out);
      s.start(t);
      lfo.start(t);
      s.stop(t + 1.2);
      lfo.stop(t + 1.2);
    }
    for (let i = 0; i < 4; i++) {
      const f = rnd(380, 700);
      tone(c, out, 'triangle', f, f * 1.25, t + rnd(0, 0.2), 0.03, 0.08, 0.5);
    }
  },
};

/** Play a procedural sound. No-op until unlocked or when the SFX volume is 0. */
export function playSfx(name: SfxName, params: SfxParams = {}): void {
  if (!ctx || !master || volume <= 0 || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const gap = MIN_GAP[name] ?? 0;
  if (now - (lastAt.get(name) ?? -1) < gap) return;
  lastAt.set(name, now);
  let out: AudioNode = master;
  if (params.gain !== undefined && params.gain !== 1) {
    const g = ctx.createGain();
    g.gain.value = Math.max(0, params.gain);
    g.connect(master);
    out = g;
  }
  try {
    SYNTHS[name](ctx, out, now + 0.005, params);
  } catch (err) {
    console.warn(`[sfx] ${name} failed`, err);
  }
}

// ---------- wheel clack rhythm ----------
let clackTimer: ReturnType<typeof setTimeout> | null = null;
let trainSpeed = 0;

/** Train speed in world units/s (0 = stopped). Clacks repeat faster as the train speeds up. */
export function setTrainSpeed(v: number): void {
  const was = clackInterval(trainSpeed);
  trainSpeed = v;
  if (was === null && clackInterval(v) !== null && !clackTimer) tickClack();
}

function tickClack(): void {
  clackTimer = null;
  const iv = clackInterval(trainSpeed);
  if (iv === null) return;
  playSfx('clack', { gain: Math.min(1, 0.35 + Math.abs(trainSpeed) * 0.1) });
  clackTimer = setTimeout(tickClack, iv * 1000);
}

export function stopClack(): void {
  if (clackTimer) clearTimeout(clackTimer);
  clackTimer = null;
  trainSpeed = 0;
}
