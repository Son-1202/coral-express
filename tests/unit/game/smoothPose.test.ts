import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { createSim } from '../../../src/sim';
import { trainPose } from '../../../src/game/pose';

/**
 * T-25: the visual pose uses the sim's unconsumed sub-tick time (`tickAcc`), so the
 * train moves every frame instead of stepping at the 4 Hz sim tick, and it is
 * exactly consistent with the sim at every tick boundary.
 */
describe('trainPose sub-tick (render interpolation)', () => {
  const data = loadGameData();
  const leg = data.config.legSeconds;
  const stop = data.config.stopSeconds;
  const pose = (s: ReturnType<typeof createSim>) => trainPose(s.state, leg, stop, s.state.tickAcc);

  it('moves smoothly every 60 fps frame: no steps, no reversals, across arrivals and departures', () => {
    const sim = createSim(data, { seed: 5 });
    const frame = 1 / 60;
    let prev = pose(sim);
    let prevD = 0;
    let maxDD = 0;
    for (let i = 0; i < 60 * (leg + stop) * 2.2; i++) {
      sim.advance(frame);
      const p = pose(sim);
      const d = p.odo - prev.odo;
      expect(d).toBeGreaterThanOrEqual(-1e-9);
      maxDD = Math.max(maxDD, Math.abs(d - prevD));
      prevD = d;
      prev = p;
    }
    // the per-frame step never changes by more than the profile's own acceleration allows
    const vmax = 1 / 0.75 / leg; // legs per second at cruise
    expect(maxDD).toBeLessThan(vmax * frame * 0.05);
    expect(prev.odo).toBeGreaterThan(1.5);
  });

  it('is identical at tick boundaries whether or not the sub-tick part is used', () => {
    const sim = createSim(data, { seed: 2 });
    for (let i = 0; i < 4 * (leg + stop) * 2; i++) {
      sim.advance(0.25);
      expect(sim.state.tickAcc).toBeCloseTo(0, 9);
      expect(pose(sim).odo).toBeCloseTo(trainPose(sim.state, leg, stop).odo, 9);
    }
  });

  it('is continuous across a tick: pose before the tick (with tickAcc) matches the state after it', () => {
    const sim = createSim(data, { seed: 9 });
    sim.advance(stop + leg * 0.5);
    for (const frac of [0.1, 0.5, 0.99]) {
      const before = pose(sim);
      const ahead = trainPose(sim.state, leg, stop, sim.state.tickAcc + 0.25 * frac);
      sim.advance(0.25 * frac);
      expect(pose(sim).odo).toBeCloseTo(ahead.odo, 9);
      expect(pose(sim).odo).toBeGreaterThan(before.odo);
    }
  });

  it('extrapolates across the leg end and the stop end without overshoot', () => {
    const sim = createSim(data, { seed: 4 });
    const s = sim.state;
    s.train.phase = 'moving';
    s.train.t = leg - 0.05;
    const base = s.lifetime.arrivals;
    expect(trainPose(s, leg, stop, 0.2).odo).toBe(base + 1);
    expect(trainPose(s, leg, stop, 0.2).vel).toBe(0);
    s.train.phase = 'stopped';
    s.train.t = stop - 0.05;
    const p = trainPose(s, leg, stop, 0.2);
    expect(p.phase).toBe('moving');
    expect(p.odo).toBeGreaterThan(base);
    expect(p.odo - base).toBeLessThan(1e-4);
  });
});
