/**
 * Ending panorama layout helpers (pure, unit-tested): spread the cast over the frame, give each
 * one a depth layer, and keep sprites from overlapping with a simple pairwise repulsion.
 */
import type { MotionProfile } from '../tank/motion';

export interface Body {
  x: number;
  y: number;
  /** Half extents of the sprite (ellipse radii). */
  rx: number;
  ry: number;
  /** Floor-locked bodies only move along x. */
  floor?: boolean;
}

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Depth layers back → front: sprite scale and opacity (farther = smaller, softer). */
export const DEPTH_LAYERS = [
  { scale: 0.7, alpha: 0.72 },
  { scale: 0.85, alpha: 0.88 },
  { scale: 1, alpha: 1 },
] as const;

export const FLOOR_PROFILES: ReadonlySet<MotionProfile> = new Set<MotionProfile>(['crawler', 'sessile', 'hopper']);

/** Layer per cast index: evenly mixed so neighbours in the list land on different depths. */
export const depthOf = (i: number): number => (i * 2 + 1) % DEPTH_LAYERS.length;

/** Jittered-grid start positions for `n` swimmers inside `box` (deterministic for a seed). */
export function spreadSlots(n: number, box: Box, seed = 1): { x: number; y: number }[] {
  if (n <= 0) return [];
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / Math.max(1e-6, h))));
  const rows = Math.max(1, Math.ceil(n / cols));
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    // stagger odd rows so columns don't line up
    const cx = (c + 0.5 + (r % 2 ? 0.25 : -0.25) + (rnd() - 0.5) * 0.3) / cols;
    const cy = (r + 0.5 + (rnd() - 0.5) * 0.3) / rows;
    out.push({ x: box.minX + Math.min(1, Math.max(0, cx)) * w, y: box.minY + cy * h });
  }
  return out;
}

/** Evenly spaced anchor x for `n` floor critters. */
export function floorAnchors(n: number, minX: number, maxX: number): number[] {
  return Array.from({ length: n }, (_, i) => minX + ((i + 0.5) / Math.max(1, n)) * (maxX - minX));
}

/**
 * One relaxation pass: overlapping pairs (ellipse test) are pushed apart along the line between
 * them, `k` = fraction of the overlap resolved this pass (0..1). Mutates and returns the bodies.
 */
export function separate<B extends Body>(bodies: B[], k = 0.5, box?: Box): B[] {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i] as B;
      const b = bodies[j] as B;
      const sx = a.rx + b.rx;
      const sy = a.ry + b.ry;
      let dx = (b.x - a.x) / sx;
      let dy = (b.y - a.y) / sy;
      if (a.floor && b.floor) dy = 0;
      let d = Math.hypot(dx, dy);
      if (d >= 1) continue;
      if (d < 1e-6) {
        dx = i % 2 ? 1 : -1;
        dy = 0;
        d = 1e-6;
      }
      const push = ((1 - d) * k) / 2;
      const ux = (dx / d) * push * sx;
      const uy = (dy / d) * push * sy;
      const fa = a.floor ? 0 : 1;
      const fb = b.floor ? 0 : 1;
      a.x -= ux;
      b.x += ux;
      // vertical push only for swimmers; a floor body gives its share to the other one
      a.y -= uy * fa * (fb ? 1 : 2);
      b.y += uy * fb * (fa ? 1 : 2);
    }
  }
  if (box) {
    for (const b of bodies) {
      b.x = Math.min(box.maxX, Math.max(box.minX, b.x));
      if (!b.floor) b.y = Math.min(box.maxY, Math.max(box.minY, b.y));
    }
  }
  return bodies;
}

/** Total overlap measure (sum of 1 − normalised distance over overlapping pairs). */
export function overlap(bodies: readonly Body[]): number {
  let sum = 0;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i] as Body;
      const b = bodies[j] as Body;
      const d = Math.hypot((b.x - a.x) / (a.rx + b.rx), (b.y - a.y) / (a.ry + b.ry));
      if (d < 1) sum += 1 - d;
    }
  }
  return sum;
}
