/** Signature slosh: damped spring on the tank tilt, kicked on brake/pull-away, settles in ~1 s. */
export class Slosh {
  tilt = 0;
  vel = 0;
  constructor(
    private readonly stiffness = 80,
    private readonly damping = 2 * 0.32 * Math.sqrt(80),
  ) {}

  /** Positive = water piles toward +x (train braking while moving +x). */
  impulse(v: number): void {
    this.vel += v;
  }

  update(dt: number): number {
    // sub-step for stability at low frame rates
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const acc = -this.stiffness * this.tilt - this.damping * this.vel;
      this.vel += acc * h;
      this.tilt += this.vel * h;
    }
    return this.tilt;
  }
}
