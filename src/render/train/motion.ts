import { legProfile } from '../anim/ease';

export interface MotionOpts {
  spacing: number;
  legSeconds: number;
  stopSeconds: number;
}

export type MotionPhase = 'stopped' | 'moving';

/**
 * Render-side placeholder schedule: stop at a platform, travel one leg with
 * eased acceleration, stop again. (Real timings come from the sim in T-04.)
 */
export class TrainMotion {
  phase: MotionPhase = 'stopped';
  station = 0;
  x = 0;
  vel = 0;
  accel = 0;
  private timer = 0;
  private listeners: ((e: 'arrive' | 'depart', station: number) => void)[] = [];

  constructor(private readonly o: MotionOpts, startStopFraction = 0.5) {
    this.timer = o.stopSeconds * startStopFraction;
  }

  on(fn: (e: 'arrive' | 'depart', station: number) => void): void {
    this.listeners.push(fn);
  }

  /** Normalised progress of the current leg (0 while stopped). */
  get legProgress(): number {
    return this.phase === 'moving' ? Math.min(1, this.timer / this.o.legSeconds) : 0;
  }

  /** Seconds until the next arrival. */
  get eta(): number {
    return this.phase === 'moving'
      ? this.o.legSeconds - this.timer
      : this.o.stopSeconds - this.timer + this.o.legSeconds;
  }

  update(dt: number): void {
    const prevVel = this.vel;
    this.timer += dt;
    if (this.phase === 'stopped') {
      this.vel = 0;
      this.x = this.station * this.o.spacing;
      if (this.timer >= this.o.stopSeconds) {
        this.timer -= this.o.stopSeconds;
        this.phase = 'moving';
        this.emit('depart', this.station);
      }
    }
    if (this.phase === 'moving') {
      const u = this.timer / this.o.legSeconds;
      if (u >= 1) {
        this.timer -= this.o.legSeconds;
        this.station += 1;
        this.phase = 'stopped';
        this.x = this.station * this.o.spacing;
        this.vel = 0;
        this.emit('arrive', this.station);
      } else {
        const p = legProfile(u);
        this.x = (this.station + p.pos) * this.o.spacing;
        this.vel = (p.vel * this.o.spacing) / this.o.legSeconds;
      }
    }
    this.accel = dt > 0 ? (this.vel - prevVel) / dt : 0;
  }

  private emit(e: 'arrive' | 'depart', s: number): void {
    for (const l of this.listeners) l(e, s);
  }
}
