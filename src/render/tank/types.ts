/**
 * Public contract of the Tank View (T-15). T-13 (controller) builds a `TankApi` from the sim:
 *   const api: TankApi = { data, state: () => sim.state, act: (a) => sim.act(a), carInfo: (id) => sim.carInfo(id) };
 * If T-14's `GameApi` (src/ui/types.ts) grows these members it can be passed directly.
 */
import type * as THREE from 'three';
import type { GameData } from '../../data/schema';
import type { Action, ActionResult, CarInfo, SimEvent, SimState } from '../../sim/types';

export interface TankApi {
  readonly data: GameData;
  state(): SimState;
  act(a: Action): ActionResult;
  carInfo(carId: string): CarInfo;
}

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TankViewCtx {
  renderer: THREE.WebGLRenderer;
  api: TankApi;
  /** Unused placeholder for T-13's asset bundle (the tank has its own fallback-aware loader). */
  assets?: unknown;
  /** Kept for the ticket signature; the tank renders its own scene on top of the train view. */
  scene?: THREE.Scene;
  /** DOM parent for the overlay (default document.body). */
  host?: HTMLElement;
  /** CSS-pixel rect of the carriage's tank on screen — the dolly starts/ends there. */
  getCarScreenRect?(carId: string): ScreenRect | null;
  /** Called when the exit dolly has finished (controller resumes train-view input). */
  onExit?(): void;
}

export interface TankView {
  enter(carId: string): void;
  exit(): void;
  /** Advance animation (call every frame while isActive()). */
  update(dt: number): void;
  /** Draw on top of the already-rendered train view (call after the train render). */
  render(): void;
  /** True from enter() until the exit dolly ends. */
  isActive(): boolean;
  /** True once the tank fully covers the screen (controller may skip the train render). */
  isCovering(): boolean;
  /** Optional: forward sim events (level-up flash, feed wiggle). Slosh is read from train state. */
  onEvent(e: SimEvent): void;
  readonly carId: string | null;
  dispose(): void;
}
