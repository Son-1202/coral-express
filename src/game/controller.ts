import { loadGameData, type GameData } from '../data/schema';
import { createSimInternal, type Ctx, type OfflineResult, type Sim, type SimEvent, type StoryData } from '../sim';
import { legSeconds } from '../sim/upgrades';
import requestsJson from '../story/requests.json';
import { Bus } from './bus';
import { trainPose, type TrainPose } from './pose';
import type { SaveData } from '../sim';
import { readSave, replaceSave, savePreviewOf, writeSave, type SavePreview } from './storage';

/** Rendering side of the game; the controller feeds it sim events and frames. */
export interface GameView {
  /** `bulk` = part of a large batch (fast-forward/offline): apply state, skip VFX. */
  handle(e: SimEvent, bulk: boolean): void;
  /** dt = clamped render step; realDt = true wall-clock gap (FPS measurement). */
  frame(dt: number, realDt: number): void;
}

export interface ControllerOpts {
  seed?: number;
  /** Ignore any stored save (new game). */
  fresh?: boolean;
  /** Disable localStorage writes (tests / screenshots). */
  noSave?: boolean;
}

/** Real-time gaps longer than this are treated as offline time (SPEC C). */
export const OFFLINE_GAP_SECONDS = 5;
export const AUTOSAVE_SECONDS = 10;
/** More events than this in one drain = bulk (no per-event VFX). */
export const BULK_EVENTS = 60;

/**
 * Owns the Sim: fixed-tick advance from rAF, offline catch-up, autosave and the
 * event bus that fans sim events out to the render view and UI subscribers.
 */
export class GameController {
  readonly data: GameData = loadGameData();
  readonly story: StoryData = requestsJson as unknown as StoryData;
  readonly bus = new Bus();
  readonly sim: Sim;
  /** Sim internals: used by debug helpers only. */
  readonly ctx: Ctx;
  readonly seed: number;
  view: GameView | null = null;
  /** Time scale (debug); 1 = real time. */
  speed = 1;
  paused = false;
  private saveTimer = 0;
  private lastFrame = -1;
  private hiddenAt: number | null = null;
  private raf = 0;
  private readonly noSave: boolean;
  /** T-36: set once an imported save is written, so nothing (autosave, pagehide) overwrites it. */
  private saveLocked = false;

  constructor(o: ControllerOpts = {}) {
    this.noSave = !!o.noSave;
    const save = o.fresh ? null : readSave();
    this.seed = o.seed ?? ((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    let made;
    try {
      made = createSimInternal(this.data, { seed: this.seed, story: this.story, now: Date.now(), ...(save ? { save } : {}) });
    } catch (err) {
      console.warn('[game] save could not be loaded, starting fresh', err);
      made = createSimInternal(this.data, { seed: this.seed, story: this.story });
    }
    this.sim = made.sim;
    this.ctx = made.ctx;
  }

  /** Current leg duration (upgrades shorten it). */
  legSeconds(): number {
    return legSeconds(this.ctx.idx, this.ctx.fx());
  }

  stopSeconds(): number {
    return this.data.config.stopSeconds;
  }

  /** Visual train pose, continuous between sim ticks (uses the unconsumed sub-tick time). */
  pose(): TrainPose {
    return trainPose(this.sim.state, this.legSeconds(), this.stopSeconds(), this.sim.state.tickAcc);
  }

  /** The offline report produced while loading the save (for the "While you were away" card). */
  get loadOfflineReport(): OfflineResult | null {
    return this.sim.offlineReport;
  }

  start(): void {
    this.drain();
    this.lastFrame = -1;
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  /** One animation frame: advance the sim, dispatch events, render. */
  frame(nowMs: number): void {
    const gap = this.lastFrame < 0 ? 0 : (nowMs - this.lastFrame) / 1000;
    this.lastFrame = nowMs;
    if (gap > OFFLINE_GAP_SECONDS) {
      this.offline(gap);
      return;
    }
    const real = Math.max(0, gap);
    const dt = Math.min(0.1, real);
    // the sim always gets the full wall-clock gap (slow frames must not lose game time)
    if (!this.paused) this.sim.advance(real * this.speed);
    this.drain();
    this.saveTimer += real;
    if (this.saveTimer >= AUTOSAVE_SECONDS) this.save();
    this.view?.frame(dt, real);
    this.bus.emit('frame', { dt });
  }

  /** Apply offline time (tab hidden / long frame gap / debug). */
  offline(seconds: number): OfflineResult {
    const r = this.sim.advanceOffline(seconds);
    this.drain();
    this.save();
    return r;
  }

  /** Advance quickly (debug): chunks so the sim stays responsive, VFX skipped. */
  fastForward(seconds: number): void {
    let left = seconds;
    while (left > 0) {
      const step = Math.min(60, left);
      this.sim.advance(step);
      left -= step;
      this.drain(true);
    }
  }

  /** Drain sim events → view + bus. */
  drain(forceBulk = false): SimEvent[] {
    const events = this.sim.drainEvents();
    if (!events.length) return events;
    const bulk = forceBulk || events.length > BULK_EVENTS;
    for (const e of events) {
      this.view?.handle(e, bulk);
      this.bus.emitSim(e);
      if (e.type === 'depotReset') this.save();
    }
    if (bulk) this.bus.emit('bulk', { count: events.length });
    return events;
  }

  save(): void {
    this.saveTimer = 0;
    if (this.noSave || this.saveLocked) return;
    const at = Date.now();
    if (writeSave(this.sim.serialize(at))) this.bus.emit('saved', { at });
  }

  // ---------------- T-36: export / import ----------------

  /** A fresh snapshot of the current game for a save code (also autosaved right now). */
  exportSave(): SaveData {
    this.save();
    return this.sim.serialize(Date.now());
  }

  /** Summary of the game running now (for the import confirm). */
  currentPreview(): SavePreview {
    return savePreviewOf(this.sim.state, Date.now());
  }

  /**
   * Dry-run: build a throwaway sim from `save` (no offline time) and summarise it.
   * Throws if the save would not load.
   */
  previewImport(save: SaveData): SavePreview {
    const { sim } = createSimInternal(this.data, { seed: this.seed, story: this.story, save });
    if (sim.state.carriages.length === 0) throw new Error('import: save has no carriages');
    sim.stats();
    return savePreviewOf(sim.state, save.savedAt);
  }

  /**
   * Replace the stored save with `save` and freeze this game so it can't save over it.
   * false → storage refused; the previous save is kept and this game carries on.
   */
  applyImport(save: SaveData): boolean {
    this.saveLocked = true;
    if (!replaceSave(save)) {
      this.saveLocked = false;
      return false;
    }
    this.stop();
    return true;
  }

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      this.hiddenAt = Date.now();
      this.save();
    } else if (this.hiddenAt !== null) {
      const away = (Date.now() - this.hiddenAt) / 1000;
      this.hiddenAt = null;
      this.lastFrame = -1;
      if (away > OFFLINE_GAP_SECONDS) this.offline(away);
    }
  };

  private readonly onPageHide = (): void => this.save();
}
