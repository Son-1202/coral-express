/** Free-swimming profiles: darter, hoverer, glider, sinuous. */
import { BaseMover, clamp, range } from './base';
import type { MotionBounds, MotionEnv, MoverOpts, Point } from './types';

/** Boids-lite: wander targets, short bursts, tail wobble frequency ∝ speed. */
export class Darter extends BaseMover {
  private target: Point;
  private retarget = 0;
  private burst = 0;
  private nextBurst: number;

  constructor(seed: number, b: MotionBounds, o: MoverOpts) {
    super('darter', seed, b, o);
    this.target = this.randomPoint(b, 0.15, 0.85);
    this.nextBurst = range(this.rand, 1.5, 4);
  }

  step(dt: number, env: MotionEnv): void {
    this.t += dt;
    const p = this.pose;
    const s = this.size;
    this.retarget -= dt;
    this.nextBurst -= dt;
    const dx0 = this.target.x - p.x;
    const dy0 = this.target.y - p.y;
    if (this.retarget <= 0 || Math.hypot(dx0, dy0) < s * 0.8) {
      this.target = this.randomPoint(env.bounds, 0.1, 0.9);
      this.retarget = range(this.rand, 2.5, 6);
    }
    if (this.nextBurst <= 0) {
      this.burst = 0.35;
      this.nextBurst = range(this.rand, 2, 5);
    }
    this.burst = Math.max(0, this.burst - dt);
    const tgt = env.food ?? this.target;
    const dx = tgt.x - p.x;
    const dy = tgt.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = s * (env.food ? 3.4 : 2.2) * (this.burst > 0 ? 2.6 : 1) * (d < s * 2 ? d / (s * 2) : 1);
    let dvx = (dx / d) * speed;
    let dvy = (dy / d) * speed * 0.7;
    // separation from neighbours
    for (const n of env.neighbors ?? []) {
      const nx = p.x - n.x;
      const ny = p.y - n.y;
      const nd = Math.hypot(nx, ny);
      if (nd > 1e-4 && nd < s * 2.2) {
        const push = ((s * 2.2 - nd) / (s * 2.2)) * s * 3;
        dvx += (nx / nd) * push;
        dvy += (ny / nd) * push;
      }
    }
    this.steer(dvx, dvy, this.burst > 0 ? 7 : 2.6, dt);
    this.face(this.vx);
    this.integrate(dt, env);
    const q = this.squash();
    p.sx = q.sx * (this.burst > 0 ? 1.08 : 1);
    p.sy = q.sy * (this.burst > 0 ? 0.94 : 1);
    p.rot = clamp(Math.atan2(this.vy, Math.abs(this.vx) + 1e-6) * 0.5, -0.4, 0.4) + q.kick * 0.25;
    p.wobbleFreq = 4 + 3.2 * (p.speed / s);
    p.wobbleAmp = 0.1 + (this.kickT > 0 ? 0.12 : 0);
    p.wave = 0;
  }
}

/** Slow bob, fin flutter, sometimes curls around a plant stem. */
export class Hoverer extends BaseMover {
  private target: Point;
  private hold = 0;
  private curling = false;

  constructor(seed: number, b: MotionBounds, o: MoverOpts) {
    super('hoverer', seed, b, o);
    this.target = this.randomPoint(b, 0.2, 0.8);
  }

  step(dt: number, env: MotionEnv): void {
    this.t += dt;
    const p = this.pose;
    const s = this.size;
    this.hold -= dt;
    const d0 = Math.hypot(this.target.x - p.x, this.target.y - p.y);
    if (this.hold <= 0 && d0 < s * 0.6) {
      const anchors = env.anchors ?? [];
      this.curling = anchors.length > 0 && this.rand() < 0.5;
      if (this.curling) {
        const a = anchors[Math.floor(this.rand() * anchors.length)] as Point;
        this.target = { x: a.x + s * 0.4, y: clamp(a.y + range(this.rand, 0.5, 2) * s, env.bounds.minY, env.bounds.maxY) };
      } else this.target = this.randomPoint(env.bounds, 0.15, 0.85);
      this.hold = range(this.rand, 3, 6);
    }
    const tgt = env.food ?? this.target;
    const dx = tgt.x - p.x;
    const dy = tgt.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = s * (env.food ? 1.2 : 0.55) * Math.min(1, d / s);
    const bob = Math.sin(this.t * 1.4 + this.phase) * s * 0.45;
    this.steer((dx / d) * sp, (dy / d) * sp + bob, 1.4, dt);
    if (Math.abs(this.vx) > s * 0.15) this.face(this.vx);
    this.integrate(dt, env, { tiltDrift: 1.6 });
    const q = this.squash();
    const curl = this.curling && d < s ? 1 : 0;
    p.sx = q.sx;
    p.sy = q.sy * (1 + Math.sin(this.t * 2.8 + this.phase) * 0.03);
    p.rot = Math.sin(this.t * 0.9 + this.phase) * 0.08 + curl * Math.sin(this.t * 0.7) * 0.18 + q.kick * 0.2;
    p.wobbleFreq = 15;
    p.wobbleAmp = 0.035 + (this.kickT > 0 ? 0.08 : 0);
    p.wave = 0.15;
  }
}

/** Long arcs with gentle body undulation (sinuous = full-body sine head→tail). */
export class Glider extends BaseMover {
  private heading: number;
  constructor(seed: number, b: MotionBounds, o: MoverOpts, private readonly sinuous = false) {
    super(sinuous ? 'sinuous' : 'glider', seed, b, o);
    this.heading = this.pose.facing > 0 ? 0 : Math.PI;
  }

  step(dt: number, env: MotionEnv): void {
    this.t += dt;
    const p = this.pose;
    const s = this.size;
    const b = env.bounds;
    let turn = Math.sin(this.t * 0.35 + this.phase) * 0.55;
    // steer back toward the middle near the walls
    const margin = s * 3;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const tgt = env.food;
    if (tgt || p.x < b.minX + margin || p.x > b.maxX - margin || p.y < b.minY + margin * 0.5 || p.y > b.maxY - margin * 0.5) {
      const want = Math.atan2((tgt?.y ?? cy) - p.y, (tgt?.x ?? cx) - p.x);
      let diff = want - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      turn = clamp(diff * 1.6, -1.4, 1.4);
    }
    this.heading += turn * dt;
    const sp = s * (this.sinuous ? 1.4 : 1.8) * (tgt ? 1.5 : 1);
    let vy = Math.sin(this.heading) * sp * 0.55;
    if (this.sinuous) vy += Math.sin(this.t * 1.6 + this.phase) * s * 0.4;
    this.steer(Math.cos(this.heading) * sp, vy, 3, dt);
    this.face(this.vx);
    this.integrate(dt, env, { tiltDrift: 0.8 });
    const q = this.squash();
    p.sx = q.sx;
    p.sy = q.sy;
    p.rot = clamp(Math.atan2(this.vy, Math.abs(this.vx) + 1e-6) * 0.6, -0.45, 0.45) + q.kick * 0.2;
    p.wobbleFreq = this.sinuous ? 5 : 2.2;
    p.wobbleAmp = (this.sinuous ? 0.1 : 0.06) + (this.kickT > 0 ? 0.1 : 0);
    p.wave = this.sinuous ? 1 : 0.35;
  }
}
