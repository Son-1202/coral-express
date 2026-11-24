import { describe, expect, it } from 'vitest';
import { createSim, type Action, type Sim } from '../../../src/sim';
import { data } from './helpers';

function script(sim: Sim, step: number): void {
  const h = sim.state.carriages[0]!.id;
  const acts: Action[] = [
    { type: 'buyFish', species: 'pebble_damsel', carId: h },
    { type: 'buyFish', species: 'carpet_anemone', carId: h },
    { type: 'feed', carId: h },
    { type: 'buildTrack' },
    { type: 'buyCarriage', habitat: 'reef' },
    { type: 'levelFish', fishId: Object.keys(sim.state.fish)[0] ?? 'x', times: 'max' },
  ];
  sim.act(acts[step % acts.length]!);
}

function run(sim: Sim, from: number, to: number): void {
  for (let i = from; i < to; i++) {
    script(sim, i);
    sim.advance(7.3);
  }
}

describe('determinism + save', () => {
  it('two sims with the same seed + actions serialize identically', () => {
    const a = createSim(data, { seed: 7 });
    const b = createSim(data, { seed: 7 });
    run(a, 0, 200);
    run(b, 0, 200);
    expect(JSON.stringify(a.serialize())).toBe(JSON.stringify(b.serialize()));
    expect(a.drainEvents()).toEqual(b.drainEvents());
  });

  it('save round-trip: serialize → createSim({save}) behaves identically', () => {
    const a = createSim(data, { seed: 9 });
    run(a, 0, 100);
    a.advance(0.1); // leave a sub-tick remainder
    const save = a.serialize(1234);
    expect(save.savedAt).toBe(1234);
    const json = JSON.parse(JSON.stringify(save));
    const b = createSim(data, { seed: 999, save: json });
    expect(JSON.stringify(b.serialize())).toBe(JSON.stringify(a.serialize()));
    run(a, 100, 250);
    run(b, 100, 250);
    expect(JSON.stringify(b.serialize())).toBe(JSON.stringify(a.serialize()));
    expect(b.stats()).toEqual(a.stats());
  });

  it('shiny rolls come from the seeded RNG (~1%)', () => {
    const sim = createSim(data, { seed: 3 });
    const h = sim.state.carriages[0]!.id;
    let shiny = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      sim.state.shells = 1e9;
      sim.act({ type: 'buyFish', species: 'pebble_damsel', carId: h });
      const id = sim.state.carriages[0]!.fish[0]!;
      if (sim.state.fish[id]!.shiny) shiny++;
      sim.act({ type: 'sellFish', fishId: id });
    }
    expect(shiny / n).toBeGreaterThan(0.004);
    expect(shiny / n).toBeLessThan(0.02);
    expect(sim.state.permanent.stamps).toContain('shiny:pebble_damsel');
  });

  it('rejects saves from a newer version', () => {
    const a = createSim(data, { seed: 1 }).serialize();
    expect(() => createSim(data, { seed: 1, save: { ...a, version: 99 } })).toThrow();
  });
});
