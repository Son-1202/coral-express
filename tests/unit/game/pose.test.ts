import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { createSim } from '../../../src/sim';
import { ODO_WRAP, trainPose } from '../../../src/game/pose';
import { Bus } from '../../../src/game/bus';

describe('trainPose', () => {
  const data = loadGameData();
  const leg = data.config.legSeconds;
  const stop = data.config.stopSeconds;

  it('odometer is monotonic and continuous across arrivals (always heading right)', () => {
    const sim = createSim(data, { seed: 3 });
    let prev = trainPose(sim.state, leg, stop).odo;
    for (let i = 0; i < 4 * 60 * 4; i++) {
      sim.advance(0.25);
      const p = trainPose(sim.state, leg, stop);
      expect(p.odo).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(p.odo - prev).toBeLessThan(0.05);
      prev = p.odo;
    }
    expect(prev).toBeGreaterThan(3);
  });

  it('stopped pose sits exactly on a platform with zero velocity', () => {
    const sim = createSim(data, { seed: 1 });
    const p = trainPose(sim.state, leg, stop);
    expect(p.phase).toBe('stopped');
    expect(p.vel).toBe(0);
    expect(Number.isInteger(p.odo)).toBe(true);
    expect(p.eta).toBeCloseTo(stop + leg, 5);
  });

  it('wraps the odometer', () => {
    const sim = createSim(data, { seed: 1 });
    sim.state.lifetime.arrivals = ODO_WRAP + 2;
    expect(trainPose(sim.state, leg, stop).odo).toBe(2);
  });
});

describe('Bus', () => {
  it('delivers typed events, * receives sim events, off unsubscribes', () => {
    const bus = new Bus();
    const got: string[] = [];
    const off = bus.on('fare', (e) => got.push(`fare:${e.amount}`));
    bus.on('*', (e) => got.push(`*:${e.type}`));
    bus.emitSim({ type: 'fare', amount: 5, station: 2 });
    off();
    bus.emitSim({ type: 'fare', amount: 6, station: 3 });
    bus.emit('selectCar', { carId: 'c1' });
    expect(got).toEqual(['fare:5', '*:fare', '*:fare']);
  });

  it('a throwing listener does not break others', () => {
    const bus = new Bus();
    let ok = false;
    bus.on('frame', () => {
      throw new Error('x');
    });
    bus.on('frame', () => (ok = true));
    const warn = console.warn;
    console.warn = () => {};
    bus.emit('frame', { dt: 0.1 });
    console.warn = warn;
    expect(ok).toBe(true);
  });
});
