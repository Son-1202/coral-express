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
 * Decorate-mode drop rule (normalised coords, y up). Near the bottom → snaps to the floor line:
 * the lowest strip is the front band (in front of fish), the rest of the floor the back band.
 * Higher up = hung on the back wall (back band, keeps its height).
 */
export function snapPlacement(x: number, y: number): { x: number; y: number; layer: DecorLayer } {
  const nx = clamp(x, 0.04, 0.96);
  if (y < FLOOR_N * 0.55) return { x: nx, y: FRONT_N, layer: 'front' };
  if (y < FLOOR_N + 0.16) return { x: nx, y: FLOOR_N, layer: 'back' };
  return { x: nx, y: clamp(y, FLOOR_N, 0.8), layer: 'back' };
}

export function clampScale(s: number): number {
  return clamp(s, SCALE_MIN, SCALE_MAX);
}

export function defaultPlacement(x: number, y: number): DecorPlacement {
  return { ...snapPlacement(x, y), scale: 1, flip: false };
}

/** Depth 0 (front glass) .. 1 (back wall) → sprite scale / tint / alpha. Farther = smaller, bluer, softer. */
export function depthLook(d: number): { scale: number; tint: number; alpha: number } {
  const t = clamp(d, -0.6, 1);
  return { scale: 1 - 0.32 * t, tint: Math.max(0, 0.42 * t), alpha: 1 - 0.22 * Math.max(0, t) };
}
