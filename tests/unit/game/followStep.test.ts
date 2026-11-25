import { describe, expect, it } from 'vitest';
import { followStep } from '../../../src/render/diorama/cameraRig';

/** T-25: the camera follow must not jitter with uneven frame times. */
describe('followStep (exact exponential follow)', () => {
  const k = 2.2;
  const v = 1.9;
  const ride = (pattern: number[], seconds: number) => {
    let t = 0;
    let target = 0;
    let prev = 0;
    let x = -v / k; // start at the steady-state lag
    const lags: number[] = [];
    for (let i = 0; t < seconds; i++) {
      const dt = pattern[i % pattern.length]!;
      t += dt;
      target = v * t;
      x = followStep(x, target, prev, dt, k);
      prev = target;
      lags.push(target - x);
    }
    return lags;
  };

  it('holds a constant lag (speed / rate) behind a steadily moving target at 60, 30 and 16/33 ms frames', () => {
    for (const p of [[1 / 60], [1 / 30], [0.016, 0.033]]) {
      for (const lag of ride(p, 3)) expect(lag).toBeCloseTo(v / k, 9);
    }
  });

  it('eases toward a still target like 1 − e^(−k·dt), independent of frame split', () => {
    const one = followStep(0, 10, 10, 0.1, k);
    let x = 0;
    for (let i = 0; i < 4; i++) x = followStep(x, 10, 10, 0.025, k);
    expect(one).toBeCloseTo(10 * (1 - Math.exp(-k * 0.1)), 9);
    expect(x).toBeCloseTo(one, 9);
  });

  it('without a previous target it is the plain damped step', () => {
    expect(followStep(0, 1, Number.NaN, 0.5, k)).toBeCloseTo(1 - Math.exp(-k * 0.5), 9);
    expect(followStep(3, 9, 0, 0, k)).toBe(3);
  });
});
