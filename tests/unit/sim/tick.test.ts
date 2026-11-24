import { describe, expect, it } from 'vitest';
import type { SimInternals } from '../../../src/sim';
import { addCar, addFish, give, heritage, make } from './helpers';

function scripted(): SimInternals {
  const t = make(42);
  const h = heritage(t);
  addFish(t, 'pebble_damsel', h);
  addFish(t, 'carpet_anemone', h);
  addFish(t, 'clownfish', h);
  const m = addCar(t, 'mangrove');
  addFish(t, 'mudskipper', m);
  addFish(t, 'clownfish', m); // off-habitat
  give(t, 1e6);
  t.sim.act({ type: 'buildTrack' });
  t.sim.act({ type: 'buildTrack' });
  t.sim.act({ type: 'feed', carId: h });
  t.ctx.state.shells = 0;
  t.sim.drainEvents();
  return t;
}

describe('tick invariance', () => {
  it('advance(600) == 2400 × advance(0.25) == uneven chunks (≤0.1%)', () => {
    const a = scripted();
    a.sim.advance(600);
    const b = scripted();
    for (let i = 0; i < 2400; i++) b.sim.advance(0.25);
    const c = scripted();
    for (const s of [13.37, 101.1, 0.05, 250.33, 77.7, 100.45, 57.0]) c.sim.advance(s);
    const sa = a.ctx.state.shells;
    expect(sa).toBeGreaterThan(0);
    expect(Math.abs(b.ctx.state.shells - sa) / sa).toBeLessThan(0.001);
    expect(Math.abs(c.ctx.state.shells - sa) / sa).toBeLessThan(0.001);
    expect(b.ctx.state.ticks).toBe(2400);
    expect(a.ctx.state.lifetime.arrivals).toBe(b.ctx.state.lifetime.arrivals);
  });

  it('accumulates sub-tick remainders', () => {
    const t = make(1);
    for (let i = 0; i < 10; i++) t.sim.advance(0.1);
    expect(t.ctx.state.ticks).toBe(4);
    expect(t.ctx.state.tickAcc).toBeCloseTo(0, 9);
  });

  it('ignores non-positive / non-finite input', () => {
    const t = make(1);
    t.sim.advance(-5);
    t.sim.advance(Number.NaN);
    expect(t.ctx.state.ticks).toBe(0);
  });
});
