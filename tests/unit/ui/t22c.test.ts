// T-22c: depot 0-ticket guard, phone toast limits, bond-aware market gain.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { createSim } from '../../../src/sim';
import { depotResetHint, fishGain, fishGainWithBonds } from '../../../src/ui/helpers';
import { MAX_TOASTS, toastLimits } from '../../../src/ui/toasts';

const data = loadGameData();
const fmt = (n: number) => String(n);

describe('depotResetHint', () => {
  const base = { runShells: 2e6, minRunShells: 1e6, terminalReached: true, projectedTickets: 3, fmt };
  it('is null when a reset would grant Tickets', () => {
    expect(depotResetHint(base)).toBeNull();
  });
  it('blocks a 0-Ticket reset (QA bug 2)', () => {
    expect(depotResetHint({ ...base, projectedTickets: 0 })).toBe('Earn more Shells for at least 1 Ticket.');
  });
  it('lists the run rules first', () => {
    expect(depotResetHint({ ...base, runShells: 10, terminalReached: false, projectedTickets: 0 })).toBe(
      'To reset: earn 1000000 Shells this run (10 so far) and reach a terminal.',
    );
  });
});

describe('toastLimits', () => {
  it('caps phones at 2 and dismisses faster', () => {
    expect(toastLimits(844)).toEqual({ max: 2, msScale: 0.6 });
    expect(toastLimits(1280)).toEqual({ max: MAX_TOASTS, msScale: 1 });
  });
});

describe('fishGainWithBonds', () => {
  it('adds the pair bonus when the purchase completes a pair', () => {
    const sim = createSim(data, { seed: 1 });
    const s = sim.state;
    s.shells = 1e9;
    s.market.fish = ['pebble_damsel', 'carpet_anemone', 'clownfish'];
    const car = s.carriages[0]!;
    const r = sim.act({ type: 'buyFish', species: 'carpet_anemone', carId: car.id });
    expect(r.ok).toBe(true);
    const sp = data.species.find((x) => x.id === 'clownfish')!;
    const plain = fishGain(data, s, sp, car.habitat);
    const est = fishGainWithBonds(data, s, sp, car, sim.carInfo(car.id));
    expect(est.bond).toContain('Carpet Anemone');
    expect(est.sps).toBeGreaterThan(plain * 1.9);
    // matches the sim: buy it and compare the car's income delta
    const before = sim.carInfo(car.id).income;
    sim.act({ type: 'buyFish', species: 'clownfish', carId: car.id });
    const delta = sim.carInfo(car.id).income - before;
    expect(est.sps).toBeCloseTo(delta, 6);
  });
  it('adds the community bonus when the purchase completes a community', () => {
    const sim = createSim(data, { seed: 1 });
    const s = sim.state;
    s.shells = 1e9;
    s.market.fish = ['pebble_damsel', 'carpet_anemone', 'clownfish'];
    const car = s.carriages[0]!;
    sim.act({ type: 'buyFish', species: 'pebble_damsel', carId: car.id });
    sim.act({ type: 'buyFish', species: 'carpet_anemone', carId: car.id });
    const sp = data.species.find((x) => x.id === 'clownfish')!;
    const est = fishGainWithBonds(data, s, sp, car, sim.carInfo(car.id));
    expect(est.bond).toContain('Reef Family');
    const before = sim.carInfo(car.id).income;
    expect(sim.act({ type: 'buyFish', species: 'clownfish', carId: car.id }).ok).toBe(true);
    expect(est.sps).toBeCloseTo(sim.carInfo(car.id).income - before, 6);
  });
  it('equals fishGain without a bond', () => {
    const sim = createSim(data, { seed: 1 });
    const car = sim.state.carriages[0]!;
    const sp = data.species.find((x) => x.id === 'pebble_damsel')!;
    const est = fishGainWithBonds(data, sim.state, sp, car, sim.carInfo(car.id));
    expect(est.bond).toBeNull();
    expect(est.sps).toBe(fishGain(data, sim.state, sp, car.habitat));
  });
});
