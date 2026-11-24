import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { createSim } from '../../../src/sim';
import {
  affordableIn, defaultMascotName, defaultTargetCar, describeUpgrade, fishGain, formatDuration,
  legProgress, lineHabitats, partnersOf, waitLabel,
} from '../../../src/ui/helpers';

const data = loadGameData();

describe('affordableIn / waitLabel', () => {
  it('is 0 when affordable, null without income', () => {
    expect(affordableIn(100, 150, 0)).toBe(0);
    expect(affordableIn(100, 100, 0)).toBe(0);
    expect(affordableIn(200, 100, 0)).toBeNull();
    expect(affordableIn(200, 100, 2.5)).toBe(40);
  });
  it('labels the wait', () => {
    expect(waitLabel(100, 150, 1)).toBe('');
    expect(waitLabel(200, 158, 1)).toBe('in 42s');
    expect(waitLabel(200, 100, 0)).toBe('save up');
  });
});

describe('formatDuration', () => {
  it('formats compactly', () => {
    expect(formatDuration(42)).toBe('42s');
    expect(formatDuration(185)).toBe('3m 5s');
    expect(formatDuration(8040)).toBe('2h 14m');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(97200)).toBe('1d 3h');
  });
});

describe('partners + default target car', () => {
  it('finds bond partners', () => {
    expect(partnersOf(data, 'clownfish')).toContain('carpet_anemone');
    expect(partnersOf(data, 'carpet_anemone')).toContain('clownfish');
  });
  it('prefers the car holding a partner, then home habitat', () => {
    const sim = createSim(data, { seed: 1 });
    const s = sim.state;
    s.shells = 1e9;
    expect(sim.act({ type: 'buyCarriage', habitat: 'mangrove' }).ok).toBe(true);
    expect(sim.act({ type: 'buyCarriage', habitat: 'reef' }).ok).toBe(true);
    const [, c2, c3] = s.carriages.map((c) => c.id);
    // mudskipper is mangrove: goes to car 2
    expect(defaultTargetCar(s, data, 'mudskipper')).toBe(c2);
    // anemone in car 3 → clownfish follows it there
    s.speciesBoughtThisRun.push('carpet_anemone');
    expect(sim.act({ type: 'buyFish', species: 'carpet_anemone', carId: c3 }).ok).toBe(true);
    expect(defaultTargetCar(s, data, 'clownfish')).toBe(c3);
  });
  it('returns null when every car is full', () => {
    const sim = createSim(data, { seed: 1 });
    const car = sim.state.carriages[0];
    car.slots = car.fish.length;
    expect(defaultTargetCar(sim.state, data, 'pebble_damsel')).toBeNull();
  });
});

describe('misc helpers', () => {
  it('fishGain applies the off-habitat penalty', () => {
    const sim = createSim(data, { seed: 1 });
    const sp = data.species.find((x) => x.id === 'clownfish')!;
    expect(fishGain(data, sim.state, sp, 'reef')).toBeCloseTo(sp.basePps);
    expect(fishGain(data, sim.state, sp, 'mangrove')).toBeCloseTo(sp.basePps * data.config.offHabitatMult);
  });
  it('describes every upgrade', () => {
    for (const u of data.upgrades) expect(describeUpgrade(u).length).toBeGreaterThan(5);
  });
  it('line habitats accumulate', () => {
    expect(lineHabitats(data, 1)).toEqual(['reef', 'mangrove']);
    expect(lineHabitats(data, 3)).toHaveLength(5);
  });
  it('mascot default name', () => {
    expect(defaultMascotName(data, 'clownfish')).toBe('Clownfish');
    expect(defaultMascotName(data, 'clownfish', 'Bubbles')).toBe('Bubbles');
  });
  it('leg progress', () => {
    const sim = createSim(data, { seed: 1 });
    const s = sim.state;
    s.train = { fromStation: 1, toStation: 2, phase: 'moving', t: 15, dir: 1 };
    expect(legProgress(s, 45, 6)).toEqual({ progress: 1 / 3, eta: 30, atStation: false });
  });
});
