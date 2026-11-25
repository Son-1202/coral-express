/**
 * Decor steering (SPEC C "fish route around decor"): pure TS, no Three.
 * Applied after a mover's step as a smoothed render offset, so every motion
 * profile bends around placed decor without changing its own rhythm; swimmers
 * also occasionally tuck into a hideout (castle / arch) for a few seconds.
 */
import type { Point } from './types';

export interface Obstacle {
  x: number;
  y: number;
  /** Radius the fish keeps clear of (world units). */
  r: number;
  /** Fish may hide inside (castle, arch). */
  hide?: boolean;
}

/** Decor ids fish hide in. */
export const HIDEOUTS = new Set(['coral_castle', 'ice_arch', 'sunken_rowboat', 'mangrove_root']);

const BLEND = 1.2;

export class DecorSteer {
  private ox = 0;
  private oy = 0;
  private phase: 'free' | 'going' | 'hidden' | 'leaving' = 'free';
  private t = 0;
  private hold = 0;
  private cooldown: number;
  private target: Point = { x: 0, y: 0 };
  /** 0 = in the open … 1 = fully tucked inside a hideout. */
  hidden = 0;
  readonly out: Point = { x: 0, y: 0 };

  constructor(private readonly rand: () => number) {
    this.cooldown = 8 + rand() * 14;
  }

  get hiding(): boolean {
    return this.phase !== 'free';
  }

  /** Force a hide now (debug / tests). Returns false without a hideout. */
  hideNow(obstacles: readonly Obstacle[]): boolean {
    const h = obstacles.filter((o) => o.hide);
    if (!h.length) return false;
    this.cooldown = 0;
    return true;
  }

  /** p = the mover's pose position; returns the steered render position in `out`. */
  step(dt: number, p: Point, obstacles: readonly Obstacle[], canHide: boolean, margin = 0.2): Point {
    // 1. avoidance: push the render position radially out of every obstacle circle
    let dx = 0;
    let dy = 0;
    for (const o of obstacles) {
      const x = p.x + this.ox - o.x;
      const y = p.y + this.oy - o.y;
      const d = Math.hypot(x, y);
      const R = o.r + margin;
      if (d >= R) continue;
      const nx = d > 1e-4 ? x / d : 0;
      const ny = d > 1e-4 ? y / d : 1;
      dx += nx * (R - d);
      dy += ny * (R - d);
    }
    // desired offset grows by the penetration; relaxes back to 0 when clear
    const k = 1 - Math.exp(-dt * 6);
    const relax = 1 - Math.exp(-dt * 1.5);
    this.ox += dx * k - this.ox * relax * (dx === 0 ? 1 : 0);
    this.oy += dy * k - this.oy * relax * (dy === 0 ? 1 : 0);
    let x = p.x + this.ox;
    let y = p.y + this.oy;

    // 2. hideouts
    const spots = obstacles.filter((o) => o.hide);
    if (this.phase === 'free') {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && canHide && spots.length) {
        const s = spots[Math.floor(this.rand() * spots.length) % spots.length] as Obstacle;
        this.target = { x: s.x, y: s.y - s.r * 0.2 };
        this.phase = 'going';
        this.t = 0;
        this.hold = 3 + this.rand() * 2.5;
      } else if (this.cooldown <= 0) this.cooldown = 4;
    }
    if (this.phase !== 'free') {
      this.t += dt;
      if (this.phase === 'going') {
        this.hidden = Math.min(1, this.t / BLEND);
        if (this.t >= BLEND) (this.phase = 'hidden'), (this.t = 0);
      } else if (this.phase === 'hidden') {
        this.hidden = 1;
        if (this.t >= this.hold) (this.phase = 'leaving'), (this.t = 0);
      } else {
        this.hidden = Math.max(0, 1 - this.t / BLEND);
        if (this.t >= BLEND) {
          this.phase = 'free';
          this.hidden = 0;
          this.cooldown = 15 + this.rand() * 15;
        }
      }
      const e = this.hidden * this.hidden * (3 - 2 * this.hidden);
      x += (this.target.x - x) * e;
      y += (this.target.y - y) * e;
    }
    this.out.x = x;
    this.out.y = y;
    return this.out;
  }
}
