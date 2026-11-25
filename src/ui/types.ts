// Contract between the UI (T-14) and the game controller (T-13).
// Aligned with src/game/bus.ts (T-13): Settings and the bus event map come from there.
import type { GameData } from '../data/schema';
import type { Action, ActionResult, OfflineResult, Sim, StoryData } from '../sim';
import type { GameEventType, Listener, Settings, UiEventMap } from '../game/bus';

export type { Settings, UiEventMap, GameEventType, Listener } from '../game/bus';
export type { SavePreview } from '../game/storage';
import type { SavePreview } from '../game/storage';

/** T-36: result of checking a pasted save code. `apply()` writes exactly the checked save. */
export type SaveCodeCheck =
  | { ok: true; preview: SavePreview; current: SavePreview; apply(): boolean }
  | { ok: false; error: string };

/** Panels the UI can open (keyboard M/T/S/D, HUD buttons, `openPanel` event). */
export type PanelId = 'market' | 'track' | 'stamps' | 'depot' | 'settings' | 'car';

/**
 * Events the UI emits for the render/audio side (render subscribes via the bus).
 * `openCarDetail` / `openPanel` may also be emitted by the canvas; the UI listens
 * to them (and to the bus' `carDetail`, its T-13 alias).
 */
export interface UIEvents {
  openCarDetail: { carId: string };
  openPanel: { id: PanelId | string };
  /** A bought item should fly into this carriage (render VFX). */
  itemFly: { carId: string; kind: 'fish' | 'decor' | 'slot' | 'carriage' | 'special'; refId: string };
  /** Sound hook: 'coin' (amount = Shells spent), 'click', 'open', 'close', 'error'. */
  uiSound: { id: 'coin' | 'click' | 'open' | 'close' | 'error'; amount?: number };
}

/** What the controller exposes to the UI. Required members are the T-14 contract. */
export interface GameApi {
  sim: Sim;
  data: GameData;
  story: StoryData;
  act(a: Action): ActionResult;
  price(a: Action): number | null;
  /** Sim events + bus UI events (see src/game/bus.ts). Returns an unsubscribe fn. */
  on<T extends GameEventType>(type: T | '*', cb: Listener<T>): () => void;
  getSettings(): Settings;
  setSettings(p: Partial<Settings>): void;
  selectCar(id: string | null): void;
  selectedCar(): string | null;
  enterTankView(carId: string): void;
  exitTankView(): void;

  // ---- optional (UI falls back gracefully when the controller lacks them) ----
  /** Emit a UI event for render/audio. */
  emitUi?<K extends keyof UIEvents>(type: K, payload: UIEvents[K]): void;
  /** Current leg duration (upgrades shorten it); fallback: config.legSeconds. */
  legSeconds?(): number;
  /** Offline report applied on load (title "time away" + offline postcard); fallback: sim.offlineReport. */
  offlineReport?(): OfflineResult | null;
  /** True when a save existed on load (title shows Continue). */
  hasSave?(): boolean;
  /** Start over: wipe the save and begin a new game (controller may reload). */
  newGame?(): void;
  /** Settings → Reset save (after the double confirm). Defaults to newGame. */
  resetSave?(): void;
  /** T-36: fresh save code of the current game (`CE1.` gzip+base64url, `CE0.` uncompressed). */
  exportSaveCode?(): Promise<string>;
  /**
   * T-36: decode + validate + dry-run a save code. Never touches the stored save; only the
   * returned `apply()` does (true → the page reloads into the imported trip).
   */
  checkSaveCode?(code: string): Promise<SaveCodeCheck>;
  /** Pause/resume the sim (title screen). */
  setPaused?(p: boolean): void;
}

/** Re-exported for convenience; the bus owns the canonical map. */
export type BusUiEvent = keyof UiEventMap;
