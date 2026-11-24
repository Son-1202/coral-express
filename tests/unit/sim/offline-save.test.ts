import { describe, expect, it } from 'vitest';
import { createSim, migrateSave, SAVE_VERSION } from '../../../src/sim';
import { addFish, data, make, noSights } from './helpers';

describe('offline', () => {
  it('earns 50% × (fish + avg fare rate) × t, capped at 8 h; expires buffs', () => {
    const t = make();
    noSights(t);
    addFish(t, 'pebble_damsel');
    const total = 0.5 + (8 * (1 + 1.4) / 2) / 51;
    t.ctx.state.shells = 0;
    t.sim.act({ type: 'feed', carId: t.ctx.state.carriages[0]!.id });
    t.sim.triggerSight('whale_breach');
    const r = t.sim.advanceOffline(3600);
    expect(r.seconds).toBe(3600);
    expect(r.shells).toBeCloseTo(0.5 * total * 3600, 6); // buffs ignored
    expect(r.stationsVisited).toBe(Math.floor(3600 / 51));
    expect(t.ctx.state.sight.active).toBeNull();
    expect(t.ctx.state.modifiers).toEqual([]);
    expect(t.sim.stats().fishSps).toBeCloseTo(0.5); // frenzy expired
    expect(t.ctx.state.lifetime.offlineShells).toBeCloseTo(r.shells);
    const capped = t.sim.advanceOffline(100 * 3600);
    expect(capped.seconds).toBe(8 * 3600);
    expect(t.sim.advanceOffline(-1)).toEqual({ seconds: 0, shells: 0, stationsVisited: 0 });
    expect(t.sim.drainEvents().filter((e) => e.type === 'offline')).toHaveLength(2);
  });

  it('createSim({save, now}) applies offline time once', () => {
    const a = createSim(data, { seed: 1 });
    a.state.shells = 1e6;
    a.act({ type: 'buyFish', species: 'pebble_damsel', carId: a.state.carriages[0]!.id });
    const save = a.serialize(1_000_000);
    const b = createSim(data, { seed: 1, save, now: 1_000_000 + 600_000 });
    expect(b.offlineReport?.seconds).toBe(600);
    expect(b.state.shells - a.state.shells).toBeCloseTo(b.offlineReport!.shells, 6);
    expect(createSim(data, { seed: 1, save }).offlineReport).toBeNull();
  });
});

describe('save / migration', () => {
  it('serialize has version 1; round-trip is identical', () => {
    const a = createSim(data, { seed: 5 });
    a.advance(300);
    const s = a.serialize();
    expect(s.version).toBe(1);
    expect(SAVE_VERSION).toBe(1);
    const b = createSim(data, { seed: 0, save: JSON.stringify(s) });
    expect(JSON.stringify(b.serialize())).toBe(JSON.stringify(s));
    a.advance(500);
    b.advance(500);
    expect(JSON.stringify(b.serialize())).toBe(JSON.stringify(a.serialize()));
  });

  it('migrates a v0 fixture (top-level tickets/upgrades, missing T-06 fields)', () => {
    const v0 = {
      version: 0,
      savedAt: 1000,
      state: {
        time: 120, shells: 500, runShells: 900, tickets: 4, totalTicketsEarned: 4, upgrades: ['express_engine'],
        stamps: ['station:l1s1'], nextId: 3, rngState: 12345, currentLine: 1, builtTo: 3, marketStation: 1,
        train: { fromStation: 1, toStation: 1, phase: 'stopped', t: 0, dir: 1 },
        carriages: [{ id: 'c1', habitat: 'reef', slots: 3, extraSlots: 0, fish: ['f2', 'f9'], decor: [],
          cosmetics: { sand: 'sand_cream', backdrop: 'backdrop_reef_0', paint: 'paint_seafoam' }, heritage: true }],
        fish: {
          f2: { id: 'f2', species: 'clownfish', level: 3, shiny: false, spent: 500, carId: 'c1' },
          f9: { id: 'f9', species: 'removed_species', level: 1, shiny: false, spent: 1, carId: 'c1' },
        },
        copiesOwned: { clownfish: 1 }, speciesBoughtThisRun: ['clownfish'],
      },
    };
    const m = migrateSave(v0);
    expect(m.version).toBe(1);
    expect(m.state.permanent.tickets).toBe(4);
    expect(m.state.permanent.upgrades).toEqual(['express_engine']);
    expect(m.state.permanent.requestHistory).toEqual([]);
    expect(m.state.lifetime.sightShells).toBe(0);
    expect(m.state.sight).toEqual({ active: null, nextAt: -1 });
    const sim = createSim(data, { seed: 1, save: v0 });
    expect(sim.state.shells).toBe(500);
    expect(sim.state.carriages[0]!.fish).toEqual(['f2']); // unknown species dropped
    expect(sim.state.market.stationId).toBe('l1s1');
    expect(sim.stats().fishSps).toBeCloseTo(9 * 3 * 1.4); // 4 tickets → ×1.4
    sim.advance(200);
    expect(sim.state.lifetime.arrivals).toBeGreaterThan(0);
    expect(v0.state).not.toHaveProperty('permanent'); // input not mutated
  });

  it('fills missing fields of a current save', () => {
    const s = JSON.parse(JSON.stringify(createSim(data, { seed: 2 }).serialize()));
    delete s.state.sight;
    delete s.state.lifetime.requestShells;
    delete s.state.permanent.requestHistory;
    s.state.shinyEggs = 'garbage';
    const m = migrateSave(s);
    expect(m.state.sight.nextAt).toBe(-1);
    expect(m.state.lifetime.requestShells).toBe(0);
    expect(m.state.permanent.requestHistory).toEqual([]);
    expect(m.state.shinyEggs).toEqual({ any: 0, species: [] });
  });

  it('invalid JSON / junk → fresh game; newer version throws', () => {
    for (const junk of ['{not json', 42, null, [], { foo: 1 }]) {
      const sim = createSim(data, { seed: 3, save: junk });
      expect(sim.state.shells).toBe(150);
      expect(sim.state.carriages).toHaveLength(1);
    }
    expect(() => migrateSave({ version: 2, savedAt: null, state: {} })).toThrow();
  });
});
