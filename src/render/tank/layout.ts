/** Tank-space layout (world units; origin bottom-left) + pure placement rules (unit-tested). */
import type { DecorLayer, DecorPlacement } from '../../sim/types';

export const TANK = {
  w: 16,
  h: 9,
  /** Sand floor line. */
  floor: 1.45,
  /** Water surface. */
  surface: 0.92 * 9,
  /** Inner margin from the glass. */
  margin: 0.45,
} as const;

/** Normalised floor line used for placements (0..1 of tank height). */
export const FLOOR_N = TANK.floor / TANK.h;
/** Front band sits just in front of the floor line. */
export const FRONT_N = FLOOR_N * 0.45;
export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.2;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Decor that hangs on the back wall (keeps the height it is dropped at). Everything else stands on
 * the sand. Render rule, not balance: a framed photo is the only wall item in decor.json today.
 */
export const WALL_DECOR: ReadonlySet<string> = new Set(['wren_photo']);
export const isWallDecor = (id: string): boolean => WALL_DECOR.has(id);

/**
 * Decorate-mode drop rule (normalised coords, y up). The lowest strip is the front band (in front
 * of fish); anywhere else, floor decor snaps to the sand line (back band). Only wall decor
 * (`wall = true`) may hang higher up on the back wall, keeping its height.
 */
export function snapPlacement(x: number, y: number, wall = false): { x: number; y: number; layer: DecorLayer } {
  const nx = clamp(x, 0.04, 0.96);
  if (y < FLOOR_N * 0.55) return { x: nx, y: FRONT_N, layer: 'front' };
  if (!wall || y < FLOOR_N + 0.16) return { x: nx, y: FLOOR_N, layer: 'back' };
  return { x: nx, y: clamp(y, FLOOR_N, 0.8), layer: 'back' };
}

/** Render height for a placement: floor decor never floats (older saves may hold mid-water y). */
export function restingY(id: string, y: number): number {
  return isWallDecor(id) ? y : Math.min(y, FLOOR_N);
}

export function clampScale(s: number): number {
  return clamp(s, SCALE_MIN, SCALE_MAX);
}

export function defaultPlacement(x: number, y: number): DecorPlacement {
  return { ...snapPlacement(x, y), scale: 1, flip: false };
}

/**
 * Depth 0 (front glass) .. 1 (back wall) → sprite scale / tint / alpha. Farther = smaller, bluer.
 * T-40: always opaque — semi-transparent fish read as grey smudges in crowded tanks (QA).
 */
export function depthLook(d: number): { scale: number; tint: number; alpha: number } {
  const t = clamp(d, -0.6, 1);
  return { scale: 1 - 0.32 * t, tint: Math.max(0, 0.42 * t), alpha: 1 };
}
