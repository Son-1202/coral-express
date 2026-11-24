/**
 * Audio entry point (T-18). `createAudio(bus, getSettings)` subscribes to sim + UI events and
 * drives music (Howler) and procedural SFX (WebAudio). Autoplay-safe: nothing loads or plays
 * until the first pointerdown / keydown / touchend.
 */
import type { Bus, Settings } from '../game/bus';
import type { LineId } from '../data/schema';
import type { UIEvents } from '../ui/types';
import { MusicPlayer } from './music';
import { dbToGain, DUCK_DB, type AudioScene } from './mix';
import { playSfx, setSfxVolume, setTrainSpeed, stopClack, unlockSfx, type SfxName, type SfxParams } from './sfx';

export type { AudioScene } from './mix';
export type { SfxName, SfxParams } from './sfx';
export { playSfx, setTrainSpeed } from './sfx';

export interface AudioOptions {
  /** Current Line at boot (default 1). */
  getLine?: () => LineId;
  /** Element to listen on for the unlock gesture (default window). */
  gestureTarget?: EventTarget;
}

export interface GameAudio {
  /** Force-unlock (call from inside a user-gesture handler). Idempotent. */
  unlock(): void;
  readonly unlocked: boolean;
  /** Music scene: a Line, the Depot, or the ending. Crossfades 2 s. */
  setScene(scene: AudioScene): void;
  /** Leave Depot/ending and return to the given (or last) Line. */
  backToLine(line?: LineId): void;
  setTrainSpeed(v: number): void;
  playSfx(name: SfxName, params?: SfxParams): void;
  /** Duck music + ambience −9 dB for a named reason. */
  duck(reason: string, on: boolean): void;
  /** Ending sequence hooks: ending theme on, game SFX ducked −9 dB; and back. */
  enterEnding(): void;
  exitEnding(line?: LineId): void;
  dispose(): void;
}

type Sub = Pick<Bus, 'on'>;

export function createAudio(bus: Sub, getSettings: () => Settings, opts: AudioOptions = {}): GameAudio {
  const music = new MusicPlayer();
  let line: LineId = opts.getLine?.() ?? 1;
  let inEnding = false;
  let unlocked = false;
  const offs: (() => void)[] = [];

  const applyVolumes = (s: Settings) => {
    music.setVolumes(s.musicVolume, s.sfxVolume);
    setSfxVolume(s.sfxVolume * (inEnding ? dbToGain(DUCK_DB) : 1));
  };
  applyVolumes(getSettings());
  music.setScene({ kind: 'line', line });

  const target = opts.gestureTarget ?? (typeof window !== 'undefined' ? window : null);
  const gestures = ['pointerdown', 'keydown', 'touchend'] as const;
  const onGesture = () => api.unlock();

  const sfx = (name: SfxName, p?: SfxParams) => playSfx(name, p);

  const api: GameAudio = {
    unlock() {
      unlockSfx();
      if (unlocked) return;
      unlocked = true;
      music.unlock();
      if (target) for (const g of gestures) target.removeEventListener(g, onGesture, true);
    },
    get unlocked() {
      return unlocked;
    },
    setScene(scene) {
      if (scene.kind === 'line') line = scene.line;
      music.setScene(scene);
    },
    backToLine(l) {
      if (l) line = l;
      music.setScene({ kind: 'line', line });
    },
    setTrainSpeed,
    playSfx: sfx,
    duck: (reason, on) => music.duck(reason, on),
    enterEnding() {
      inEnding = true;
      applyVolumes(getSettings());
      music.setScene({ kind: 'ending' });
      stopClack();
    },
    exitEnding(l) {
      inEnding = false;
      applyVolumes(getSettings());
      api.backToLine(l);
    },
    dispose() {
      for (const off of offs) off();
      if (target) for (const g of gestures) target.removeEventListener(g, onGesture, true);
      stopClack();
      music.dispose();
    },
  };

  if (target) for (const g of gestures) target.addEventListener(g, onGesture, { capture: true, passive: true });

  // ---- sim events ----
  offs.push(
    bus.on('purchase', () => sfx('bubble')),
    bus.on('levelUp', () => sfx('sparkle')),
    bus.on('milestone', () => sfx('fanfare')),
    bus.on('fare', (e) => sfx('coin', { amount: e.amount })),
    bus.on('arrive', (e) => {
      sfx('bell');
      if (!inEnding && e.line !== line) api.setScene({ kind: 'line', line: e.line });
    }),
    bus.on('depart', () => {
      if (Math.random() < 0.5) sfx('gull', { gain: 0.7 });
    }),
    bus.on('frenzy', () => {
      sfx('splash');
      sfx('cheer', { gain: 0.6 });
    }),
    bus.on('bondFormed', () => sfx('cheer', { gain: 0.5 })),
    bus.on('requestCompleted', () => sfx('cheer', { gain: 0.7 })),
    bus.on('sightStart', (e) => {
      if (e.sightId.includes('whale')) music.whaleSong();
    }),
    bus.on('lineOpened', (e) => {
      sfx('fanfare');
      if (!inEnding) api.setScene({ kind: 'line', line: e.line });
    }),
    bus.on('depotReset', (e) => {
      sfx('fanfare');
      api.setScene({ kind: 'line', line: e.line });
    }),
    bus.on('ending', () => api.enterEnding()),
    bus.on('settings', (s) => applyVolumes(s)),
    bus.on('openPanel', (e) => {
      if (e.id === 'depot') api.setScene({ kind: 'depot' });
    }),
  );
  // UI sound hook: emitted via api.emitUi on the same bus (string-typed extension, see game/api.ts)
  const onUi = bus.on as unknown as (t: string, cb: (e: UIEvents['uiSound']) => void) => () => void;
  offs.push(
    onUi.call(bus, 'uiSound', (e) => {
      if (e.id === 'coin') sfx('coin', { amount: e.amount ?? 1 });
      else sfx(e.id);
    }),
  );

  return api;
}
