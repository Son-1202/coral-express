/** Swarm profile: 40–80 tiny agents flocking (cohesion to a wandering centre, alignment, separation). */
import { BaseMover, clamp, range } from './base';
import type { MotionBounds, MotionEnv, MoverOpts, Point } from './types';

export const SWARM_MIN = 40;
export const SWARM_MAX = 80;

export class Swarm extends BaseMover {
  readonly count: number;
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  readonly vxs: Float32Array;
  readonly vys: Float32Array;
  /** Per-agent phase (tail flicker). */
  readonly phases: Float32Array;
  private centre: Point;
  private retarget = 0;

  constructor(seed: number, b: MotionBounds, o: MoverOpts & { count?: number }) {
    super('swarm', seed, b, o);
    this.count = clamp(Math.round(o.count ?? range(this.rand, 50, 70)), SWARM_MIN, SWARM_MAX);
    this.xs = new Float32Array(this.count);
    this.ys = new Float32Array(this.count);
    this.vxs = new Float32Array(this.count);
    this.vys = new Float32Array(this.count);
    this.phases = new Float32Array(this.count);
    this.centre = { x: this.pose.x, y: this.pose.y };
    const r = this.size * 2;
    for (let i = 0; i < this.count; i++) {
      this.xs[i] = this.pose.x + range(this.rand, -r, r);
      this.ys[i] = this.pose.y + range(this.rand, -r, r) * 0.6;
      this.phases[i] = this.rand() * Math.PI * 2;
    }
  }

  step(dt: number, env: MotionEnv): void {
    this.t += dt;
    const b = env.bounds;
    const s = this.size;
    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.centre = this.randomPoint(b, 0.2, 0.8);
      this.retarget = range(this.rand, 3, 6);
    }
    const goal = env.food ?? this.centre;
    // swarm "leader" pose = centroid
    let cx = 0;
    let cy = 0;
    let avx = 0;
    let avy = 0;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      cx += this.xs[i] as number;
      cy += this.ys[i] as number;
      avx += this.vxs[i] as number;
      avy += this.vys[i] as number;
    }
    cx /= n;
    cy /= n;
    avx /= n;
    avy /= n;
    const sep = s * 0.35;
    const maxV = s * (env.food ? 4.5 : 3);
    const drift = env.tilt * s * 5;
    for (let i = 0; i < n; i++) {
      const x = this.xs[i] as number;
      const y = this.ys[i] as number;
      let ax = (goal.x - x) * 0.9 + (cx - x) * 0.6 + (avx - (this.vxs[i] as number)) * 0.8;
      let ay = (goal.y - y) * 0.9 + (cy - y) * 0.6 + (avy - (this.vys[i] as number)) * 0.8;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = x - (this.xs[j] as number);
        const dy = y - (this.ys[j] as number);
        const d2 = dx * dx + dy * dy;
        if (d2 < sep * sep && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const k = ((sep - d) / sep) * s * 14;
          ax += (dx / d) * k;
          ay += (dy / d) * k;
        }
      }
      const ph = this.phases[i] as number;
      ax += Math.sin(this.t * 2.1 + ph) * s * 2;
      ay += Math.cos(this.t * 1.7 + ph * 1.3) * s * 1.5;
      let vx = (this.vxs[i] as number) + ax * dt;
      let vy = (this.vys[i] as number) + ay * dt;
      const v = Math.hypot(vx, vy);
      if (v > maxV) {
        vx = (vx / v) * maxV;
        vy = (vy / v) * maxV;
      }
      let nx = x + (vx + drift) * dt;
      let ny = y + vy * dt;
      if (nx < b.minX) (nx = b.minX), (vx = Math.abs(vx));
      if (nx > b.maxX) (nx = b.maxX), (vx = -Math.abs(vx));
      if (ny < b.minY) (ny = b.minY), (vy = Math.abs(vy));
      if (ny > b.maxY) (ny = b.maxY), (vy = -Math.abs(vy));
      this.xs[i] = nx;
      this.ys[i] = ny;
      this.vxs[i] = vx;
      this.vys[i] = vy;
    }
    const p = this.pose;
    p.x = cx;
    p.y = cy;
    p.speed = Math.hypot(avx, avy);
    this.face(avx);
    this.kickT = Math.max(0, this.kickT - dt);
    p.wobbleFreq = 14;
    p.wobbleAmp = 0.1;
  }

  /** Swarm wiggle: scatter a little. */
  override kick(): void {
    super.kick();
    for (let i = 0; i < this.count; i++) {
      this.vxs[i] = (this.vxs[i] as number) + (this.rand() - 0.5) * this.size * 6;
      this.vys[i] = (this.vys[i] as number) + (this.rand() - 0.5) * this.size * 6;
    }
  }

  /** Spread (max distance of any agent from the centroid) — for tests. */
  spread(): number {
    let m = 0;
    for (let i = 0; i < this.count; i++) m = Math.max(m, Math.hypot((this.xs[i] as number) - this.pose.x, (this.ys[i] as number) - this.pose.y));
    return m;
  }
}
