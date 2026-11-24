/** Floor / special profiles: crawler, hopper, pulser, sessile. */
import { BaseMover, clamp, range } from './base';
import type { MotionBounds, MotionEnv, MoverOpts } from './types';

/** Floor-locked short scuttle-hops with an occasional claw-snap squash. */
export class Crawler extends BaseMover {
  private hopT = -1;
  private hopDur = 0.35;
  private hopDx = 0;
  private hopH = 0;
  private baseX = 0;
  private idle: number;
  private snap = 0;

  constructor(seed: number, b: MotionBounds, o: MoverOpts) {
    super('crawler', seed, b, o);
    this.floorLocked = true;
    this.pose.x = o.anchorX ?? this.pose.x;
    this.pose.y = b.floorY;
    this.idle = range(this.rand, 0.3, 1.2);
  }

  step(dt: number, env: MotionEnv): void {
    this.t += dt;
    const p = this.pose;
    const s = this.size;
    const b = env.bounds;
    this.snap = Math.max(0, this.snap - dt);
    if (this.hopT < 0) {
      this.idle -= dt;
      if (this.idle <= 0) {
        let dir = this.rand() < 0.5 ? -1 : 1;
        if (env.food) dir = env.food.x > p.x ? 1 : -1;
        else if (p.x < b.minX + s * 2) dir = 1;
        else if (p.x > b.maxX - s * 2) dir = -1;
        this.hopDx = dir * range(this.rand, 0.6, 1.8) * s;
        this.hopH = range(this.rand, 0.15, 0.4) * s;
        this.hopDur = range(this.rand, 0.28, 0.45);
        this.baseX = p.x;
        this.hopT = 0;
        if (this.hopDx * p.facing < 0) {
          p.facing = p.facing > 0 ? -1 : 1;
          this.turnPulse = 1;
        }
      }
    }
    let lift = 0;
    if (this.hopT >= 0) {
      this.hopT += dt;
      const u = clamp(this.hopT / this.hopDur, 0, 1);
      p.x = clamp(this.baseX + this.hopDx * (u * u * (3 - 2 * u)), b.minX, b.maxX);
      lift = Math.sin(u * Math.PI) * this.hopH;
      if (u >= 1) {
        this.hopT = -1;
        this.idle = range(this.rand, 0.5, 2.2);
        if (this.rand() < 0.3) this.snap = 0.18;
      }
    }
    this.vx = 0;
    this.vy = 0;
    p.x += env.tilt * s * 0.8 * dt; // heavy: barely drifts
    p.x = clamp(p.x, b.minX, b.maxX);
    p.y = b.floorY + lift;
    this.integrate(dt, env, { tiltDrift: 0 });
    p.speed = this.hopT >= 0 ? Math.abs(this.hopDx) / this.hopDur : 0;
    const q = this.squash();
    const sn = this.snap > 0 ? Math.sin((this.snap / 0.18) * Math.PI) : 0;
    p.sx = q.sx * (1 + 0.22 * sn);
    p.sy = q.sy * (1 - 0.18 * sn) * (this.hopT >= 0 ? 1.05 : 1);
    p.rot = q.kick * 0.15 + (this.hopT >= 0 ? -0.08 * p.facing : 0);
    p.wobbleFreq = this.hopT >= 0 ? 22 : 3;
    p.wobbleAmp = this.hopT >= 0 ? 0.03 : 0.01 + (this.kickT > 0 ? 0.06 : 0);
    p.wave = 0;
  }
}

/** Mudskipper: big hops along the floor; sometimes leaps onto the front glass and sticks. */
export class Hopper extends BaseMover {
  private mode: 'idle' | 'hop' | 'glass' | 'drop' = 'idle';
  private timer: number;
  private hop = { t: 0, dur: 0.5, x0: 0, y0: 0, x1: 0, y1: 0, h: 0 };

  constructor(seed: number, b: MotionBounds, o: MoverOpts) {
    super('hopper', seed, b, o);
    this.floorLocked = true;
    this.pose.y = b.floorY;
    this.timer = range(this.rand, 0.4, 1.5);
  }

  /** True while stuck on the glass (for tests / effects). */
  get onGlass(): boolean {
    return this.mode === 'glass';
  }

  step(dt: number, env: MotionEnv): void {
    this.t += dt;
    const p = this.pose;
    const s = this.size;
    const b = env.bounds;
    this.timer -= dt;
    if (this.mode === 'idle' && this.timer <= 0) {
      const toGlass = !env.food && this.rand() < 0.3;
      let dir = this.rand() < 0.5 ? -1 : 1;
      if (env.food) dir = env.food.x > p.x ? 1 : -1;
      else if (p.x < b.minX + s * 4) dir = 1;
      else if (p.x > b.maxX - s * 4) dir = -1;
      const x1 = clamp(p.x + dir * range(this.rand, 1.2, 3.2) * s, b.minX, b.maxX);
      const y1 = toGlass ? range(this.rand, 0.35, 0.75) * (b.maxY - b.floorY) + b.floorY : b.floorY;
      this.hop = { t: 0, dur: toGlass ? 0.6 : range(this.rand, 0.4, 0.55), x0: p.x, y0: p.y, x1, y1, h: range(this.rand, 1.2, 3.2) * s };
      this.mode = 'hop';
      if (dir !== p.facing) {
        p.facing = dir > 0 ? 1 : -1;
        this.turnPulse = 1;
      }
    }
    let stretch = 1;
    if (this.mode === 'hop') {
      const h = this.hop;
      h.t += dt;
      const u = clamp(h.t / h.dur, 0, 1);
      p.x = h.x0 + (h.x1 - h.x0) * u;
      p.y = h.y0 + (h.y1 - h.y0) * u + Math.sin(u * Math.PI) * h.h;
      stretch = 1 + 0.25 * Math.sin(u * Math.PI);
      if (u >= 1) {
        if (h.y1 > b.floorY + 1e-6) {
          this.mode = 'glass';
          this.timer = range(this.rand, 2, 4);
        } else {
          this.mode = 'idle';
          this.timer = range(this.rand, 0.5, 2);
        }
      }
    } else if (this.mode === 'glass') {
      p.y = Math.max(b.floorY, p.y - s * 0.12 * dt); // slowly slides down the glass
      if (this.timer <= 0) {
        this.mode = 'drop';
        this.vy = 0;
      }
    } else if (this.mode === 'drop') {
      this.vy -= s * 30 * dt;
      p.y += this.vy * dt;
      if (p.y <= b.floorY) {
        p.y = b.floorY;
        this.vy = 0;
        this.mode = 'idle';
        this.timer = range(this.rand, 0.6, 1.8);
      }
    }
    const glassT = this.mode === 'glass' ? 1 : 0;
    p.depthBias += ((glassT ? -0.45 : 0) - p.depthBias) * (1 - Math.exp(-8 * dt));
    this.vx = 0;
    const keepVy = this.vy;
    this.vy = 0;
    this.integrate(dt, env, { tiltDrift: this.mode === 'idle' ? 0.2 : 0.6 });
    this.vy = keepVy;
    p.speed = this.mode === 'hop' ? Math.abs(this.hop.x1 - this.hop.x0) / this.hop.dur : 0;
    const q = this.squash();
    p.sx = q.sx * (1 / stretch) * (glassT ? 1.12 : 1);
    p.sy = q.sy * stretch * (glassT ? 0.9 : 1);
    p.rot = (this.mode === 'hop' ? 0.25 * p.facing * Math.cos((this.hop.t / this.hop.dur) * Math.PI) : 0) + q.kick * 0.2;
    p.wobbleFreq = this.mode === 'idle' ? 2 : 10;
    p.wobbleAmp = 0.04 + (this.kickT > 0 ? 0.08 : 0);
    p.wave = 0;
  }
}

/** Octopus: contract → jet (stretch) → drift/sink, tentacles waving. */
export class Pulser extends BaseMover {
  private stage: 'drift' | 'contract' | 'jet' = 'drift';
  private timer: number;

  constructor(seed: number, b: MotionBounds, o: MoverOpts) {
    super('pulser', seed, b, o);
    this.timer = range(this.rand, 0.5, 1.5);
  }

  step(dt: number, env: MotionEnv): void {
    this.t += dt;
    const p = this.pose;
    const s = this.size;
    const b = env.bounds;
    this.timer -= dt;
    let sx = 1;
    let sy = 1;
    if (this.stage === 'drift') {
      this.steer(this.vx * 0.2, -s * 0.35, 1.2, dt);
      if (this.timer <= 0) {
        this.stage = 'contract';
        this.timer = 0.25;
      }
    } else if (this.stage === 'contract') {
      const u = 1 - this.timer / 0.25;
      sx = 1 + 0.16 * u;
      sy = 1 - 0.22 * u;
      this.steer(0, 0, 4, dt);
      if (this.timer <= 0) {
        this.stage = 'jet';
        this.timer = 0.45;
        const tx = env.food?.x ?? range(this.rand, b.minX, b.maxX);
        const ty = env.food?.y ?? range(this.rand, (b.minY + b.maxY) / 2, b.maxY);
        const dx = tx - p.x;
        const dy = Math.max(ty - p.y, s);
        const d = Math.hypot(dx, dy) || 1;
        this.vx = (dx / d) * s * 4.2;
        this.vy = (dy / d) * s * 4.2;
        this.face(this.vx);
      }
    } else {
      const u = this.timer / 0.45;
      sx = 1 - 0.14 * u;
      sy = 1 + 0.25 * u;
      this.steer(0, 0, 1.6, dt);
      if (this.timer <= 0) {
        this.stage = 'drift';
        this.timer = range(this.rand, 1.2, 2.4);
      }
    }
    this.integrate(dt, env, { tiltDrift: 1 });
    const q = this.squash();
    p.sx = q.sx * sx;
    p.sy = q.sy * sy;
    p.rot = clamp(this.vx / (s * 8), -0.35, 0.35) * -p.facing + q.kick * 0.2;
    p.wobbleFreq = 3.2;
    p.wobbleAmp = 0.07 + (this.kickT > 0 ? 0.06 : 0);
    p.wave = 1;
  }
}

/** Anchored to the floor; whole body sways, tentacles wave, leans with the slosh. */
export class Sessile extends BaseMover {
  private readonly freq: number;
  constructor(seed: number, b: MotionBounds, o: MoverOpts) {
    super('sessile', seed, b, o);
    this.floorLocked = true;
    this.pose.x = o.anchorX ?? this.pose.x;
    this.pose.y = b.floorY;
    this.freq = (o.swayFreq ?? 1) * range(this.rand, 0.8, 1.2);
  }

  step(dt: number, env: MotionEnv): void {
    this.t += dt;
    const p = this.pose;
    p.y = env.bounds.floorY;
    this.kickT = Math.max(0, this.kickT - dt);
    const k = this.kickT > 0 ? Math.sin(this.t * 30) * (this.kickT / 0.6) : 0;
    p.rot = Math.sin(this.t * 1.3 * this.freq + this.phase) * 0.05 - env.tilt * 0.3 + k * 0.08;
    p.sx = 1 + Math.sin(this.t * 0.9 * this.freq + this.phase) * 0.02;
    p.sy = 1 + Math.sin(this.t * 0.9 * this.freq + this.phase + 1.5) * 0.03 + k * 0.05;
    p.wobbleFreq = 2.4 * this.freq;
    p.wobbleAmp = 0.06 + (this.kickT > 0 ? 0.05 : 0);
    p.wave = 0.6;
    p.speed = 0;
  }
}
