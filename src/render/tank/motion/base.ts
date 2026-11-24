import type { MotionBounds, MotionEnv, MotionProfile, Mover, MoverOpts, Pose } from './types';
import { clamp, makeRng, range } from './rng';

export const newPose = (x: number, y: number): Pose => ({
  x, y, facing: 1, sx: 1, sy: 1, rot: 0, wobbleFreq: 6, wobbleAmp: 0.1, wave: 0, depthBias: 0, speed: 0,
});

/** Shared state + helpers: facing with turn squash, kick wiggle, tilt drift, bounds. */
export abstract class BaseMover implements Mover {
  readonly pose: Pose;
  readonly rand: () => number;
  readonly size: number;
  vx = 0;
  vy = 0;
  t = 0;
  /** 1 → 0 after a turn (mirror with squash). */
  turnPulse = 0;
  /** Seconds of wiggle left. */
  kickT = 0;
  phase: number;
  /** Floor-locked critters ignore the vertical part of the bounds. */
  protected floorLocked = false;

  constructor(readonly profile: MotionProfile, seed: number, b: MotionBounds, opts: MoverOpts) {
    this.rand = makeRng(seed * 7919 + 13);
    this.size = opts.size ?? 0.4;
    this.phase = this.rand() * Math.PI * 2;
    this.pose = newPose(range(this.rand, b.minX, b.maxX), range(this.rand, b.minY, b.maxY));
    this.pose.facing = this.rand() < 0.5 ? 1 : -1;
  }

  abstract step(dt: number, env: MotionEnv): void;

  kick(): void {
    this.kickT = 0.6;
  }

  place(x: number, y: number): void {
    this.pose.x = x;
    this.pose.y = y;
  }

  /** Mirror when horizontal velocity changes sign (with hysteresis). */
  protected face(vx: number): void {
    const th = 0.08 * this.size;
    if (vx > th && this.pose.facing < 0) {
      this.pose.facing = 1;
      this.turnPulse = 1;
    } else if (vx < -th && this.pose.facing > 0) {
      this.pose.facing = -1;
      this.turnPulse = 1;
    }
  }

  /** Integrate velocity, drift with slosh, clamp + bounce, write squash/kick into the pose. */
  protected integrate(dt: number, env: MotionEnv, opts: { tiltDrift?: number } = {}): void {
    const b = env.bounds;
    const p = this.pose;
    const drift = (opts.tiltDrift ?? 1.2) * env.tilt * this.size * 4;
    p.x += (this.vx + drift) * dt;
    p.y += this.vy * dt;
    if (p.x < b.minX) {
      p.x = b.minX;
      this.vx = Math.abs(this.vx) * 0.5;
    } else if (p.x > b.maxX) {
      p.x = b.maxX;
      this.vx = -Math.abs(this.vx) * 0.5;
    }
    const lo = this.floorLocked ? b.floorY : b.minY;
    if (p.y < lo) {
      p.y = lo;
      this.vy = Math.max(0, this.vy);
    } else if (p.y > b.maxY) {
      p.y = b.maxY;
      this.vy = -Math.abs(this.vy) * 0.5;
    }
    p.speed = Math.hypot(this.vx, this.vy);
    this.turnPulse = Math.max(0, this.turnPulse - dt / 0.22);
    this.kickT = Math.max(0, this.kickT - dt);
  }

  /** Base squash from turning + wiggle from kick; profiles multiply their own on top. */
  protected squash(): { sx: number; sy: number; kick: number } {
    const k = this.kickT > 0 ? Math.sin(this.t * 40) * (this.kickT / 0.6) : 0;
    return { sx: 1 - 0.45 * this.turnPulse, sy: 1 + 0.12 * this.turnPulse, kick: k };
  }

  /** Steer velocity toward a desired velocity (exponential approach). */
  protected steer(dvx: number, dvy: number, rate: number, dt: number): void {
    const a = 1 - Math.exp(-rate * dt);
    this.vx += (dvx - this.vx) * a;
    this.vy += (dvy - this.vy) * a;
  }

  protected randomPoint(b: MotionBounds, yLo = 0, yHi = 1): { x: number; y: number } {
    return {
      x: range(this.rand, b.minX, b.maxX),
      y: b.minY + (b.maxY - b.minY) * range(this.rand, yLo, yHi),
    };
  }
}

export { clamp, range };
