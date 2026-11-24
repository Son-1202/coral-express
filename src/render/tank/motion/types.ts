/**
 * Motion profile types (SPEC C). Pure TS: no Three / DOM, so profiles are reusable by the
 * train view and unit-testable. Units are world units of whatever space the caller uses;
 * all speeds are scaled by `MoverOpts.size` (the sprite's half-height) so small and large
 * critters read the same.
 */
import type { MotionProfile } from '../../../data/schema';

export type { MotionProfile };

export interface MotionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Floor line (crawlers/sessile sit on it). Usually === minY. */
  floorY: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface MotionEnv {
  time: number;
  bounds: MotionBounds;
  /** Slosh tilt (−1..1-ish): contents drift with it. */
  tilt: number;
  /** Cosmetic food the critter swims to (null = none). */
  food: Point | null;
  /** Other fish positions (boids-lite separation for darters). */
  neighbors?: readonly Point[];
  /** Plant stems hoverers like to curl around. */
  anchors?: readonly Point[];
}

/** Everything the renderer needs to draw one critter this frame. */
export interface Pose {
  x: number;
  y: number;
  /** +1 = facing right (sprites are painted facing right). */
  facing: 1 | -1;
  /** Squash/stretch multipliers (turn squash, hop stretch, jet pulse). */
  sx: number;
  sy: number;
  /** Body rotation in radians (bank, lean, sway). */
  rot: number;
  /** Tail wobble (vertex shader): frequency in rad/s and amplitude (fraction of height). */
  wobbleFreq: number;
  wobbleAmp: number;
  /** 0..1: whole-body sine wave head→tail (sinuous / glider undulation / tentacles). */
  wave: number;
  /** Depth nudge (negative = closer to the front glass, e.g. hopper stuck on glass). */
  depthBias: number;
  /** Speed (world units/s), for effects. */
  speed: number;
}

export interface Mover {
  readonly profile: MotionProfile;
  readonly pose: Pose;
  step(dt: number, env: MotionEnv): void;
  /** Wiggle (fed / tapped). */
  kick(): void;
  /** Teleport (e.g. bounds changed). */
  place(x: number, y: number): void;
}

export interface MoverOpts {
  /** Half-height of the sprite in world units (default 0.4). */
  size?: number;
  /** Sessile/crawler anchor x (default: random). */
  anchorX?: number;
  /** Sway frequency multiplier (sessile). */
  swayFreq?: number;
}
