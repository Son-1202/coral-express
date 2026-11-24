import type { SimEvent, SimEventType } from '../sim';

/** Events that do not come from the sim (render/controller → UI). */
export interface UiEventMap {
  /** A car was selected (keyboard, click, long-press). */
  selectCar: { carId: string };
  /** Long-press / right-click on a car: UI should open the car detail panel. */
  carDetail: { carId: string };
  /** Tank View entered/left (T-15). */
  tankView: { carId: string | null };
  /** Settings changed. */
  settings: Settings;
  /** Once per rendered frame, after the sim advanced (cheap UI refresh hook). */
  frame: { dt: number };
  /** Game saved to localStorage. */
  saved: { at: number };
  /** A UI panel was requested by the canvas/debug (e.g. 'depot', 'market'). */
  openPanel: { id: string };
  /** A sim event batch was processed in bulk (fast-forward / offline); VFX skipped. */
  bulk: { count: number };
}

export type SimEventOf<T extends SimEventType> = Extract<SimEvent, { type: T }>;
export type GameEventType = SimEventType | keyof UiEventMap;
export type GameEventPayload<T extends GameEventType> = T extends SimEventType
  ? SimEventOf<T>
  : T extends keyof UiEventMap
    ? UiEventMap[T]
    : never;
export type Listener<T extends GameEventType> = (e: GameEventPayload<T>) => void;

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  quality: 'auto' | 'high' | 'low';
  numberFormat: 'short' | 'scientific';
}

export const DEFAULT_SETTINGS: Settings = { musicVolume: 0.7, sfxVolume: 0.8, quality: 'auto', numberFormat: 'short' };

/** Tiny typed pub/sub. `'*'` listeners receive every sim event. */
export class Bus {
  private readonly map = new Map<string, Set<(e: unknown) => void>>();

  on<T extends GameEventType>(type: T | '*', cb: Listener<T>): () => void {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(cb as (e: unknown) => void);
    return () => this.off(type, cb);
  }

  off<T extends GameEventType>(type: T | '*', cb: Listener<T>): void {
    this.map.get(type)?.delete(cb as (e: unknown) => void);
  }

  emit<T extends GameEventType>(type: T, payload: GameEventPayload<T>): void {
    const run = (set: Set<(e: unknown) => void> | undefined) => {
      if (!set) return;
      for (const cb of [...set]) {
        try {
          cb(payload);
        } catch (err) {
          console.warn(`[bus] listener for ${type} failed`, err);
        }
      }
    };
    run(this.map.get(type));
  }

  emitSim(e: SimEvent): void {
    this.emit(e.type, e as GameEventPayload<typeof e.type>);
    const all = this.map.get('*');
    if (all) for (const cb of [...all]) cb(e);
  }
}
