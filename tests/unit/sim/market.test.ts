import { describe, expect, it } from 'vitest';
import { createSim } from '../../../src/sim';
import { addFish, data, give, heritage, make, noSights } from './helpers';

describe('station markets', () => {
  it('fish stall: signature + 2 earlier species; first sale only from the stall', () => {
    const t = make();
    noSights(t);
    give(t, 1e9);
    for (let i = 0; i < 4; i++) t.sim.act({ type: 'buildTrack' });
    expect(t.ctx.state.market.fish).toEqual(['pebble_damsel']);
    t.sim.advance(51 * 2);
    expect(t.ctx.state.market).toMatchObject({ station: 3, stationId: 'l1s3', fish: ['clownfish', 'carpet_anemone', 'pebble_damsel'] });
    const h = heritage(t);
    expect(t.sim.act({ type: 'buyFish', species: 'mudskipper', carId: h })).toEqual({ ok: false, reason: 'unavailable' });
    expect(t.sim.act({ type: 'buyFish', species: 'carpet_anemone', carId: h }).ok).toBe(true);
    t.sim.advance(51);
    expect(t.ctx.state.market.fish).toEqual(['mudskipper', 'clownfish', 'carpet_anemone']);
    // Catalogue: bought this run → buyable anywhere
    expect(t.sim.act({ type: 'buyFish', species: 'carpet_anemone', carId: h }).ok).toBe(true);
  });

  it('decor stall: 3 seeded items of the line pool, rerolled each arrival, deterministic by seed', () => {
    const run = (seed: number): string[][] => {
      const sim = createSim(data, { seed });
      const out: string[][] = [];
      for (let i = 0; i < 6; i++) { out.push([...sim.state.market.decor]); sim.advance(51); }
      return out;
    };
    const a = run(11);
    expect(run(11)).toEqual(a);
    expect(run(12)).not.toEqual(a);
    for (const d of a) {
      expect(new Set(d).size).toBe(3);
      for (const id of d) expect(data.decor.find((x) => x.id === id)?.pool ?? data.plants.find((p) => p.id === id)?.pool).toBe('l1');
    }
    expect(new Set(a.map((d) => d.join())).size).toBeGreaterThan(1);
    const t = make(11);
    give(t, 1e9);
    const off = ['sea_glass', 'seagrass_tuft', 'sea_fan', 'treasure_chest', 'mangrove_root', 'coral_castle'].find((id) => !t.ctx.state.market.decor.includes(id))!;
    expect(t.sim.act({ type: 'buyDecor', decorId: off })).toEqual({ ok: false, reason: 'unavailable' });
    const on = t.ctx.state.market.decor[0]!;
    expect(t.sim.act({ type: 'buyDecor', decorId: on }).ok).toBe(true);
    t.ctx.state.market.decor = [];
    expect(t.sim.act({ type: 'buyDecor', decorId: on }).ok).toBe(true); // restock owned item
  });

  it("Today's Special price ≈ 120 s of income, min 50", () => {
    const t = make();
    noSights(t);
    expect(t.ctx.state.market.special!.price).toBe(50);
    give(t, 1e9);
    t.ctx.state.speciesBoughtThisRun.push('clownfish');
    const c = addFish(t, 'clownfish');
    t.sim.act({ type: 'levelFish', fishId: c, times: 20 });
    t.sim.advance(51);
    const s = t.sim.stats();
    expect(t.ctx.state.market.special!.price).toBeCloseTo(120 * (s.fishSps + s.fareSps), 6);
  });

  it('special kinds: level discount, shiny egg, free slot, cosmetic; sold once', () => {
    const t = make();
    const h = heritage(t);
    give(t, 1e9);
    const c = addFish(t, 'clownfish');
    const m = t.ctx.state.market;
    m.special = { kind: 'levelDiscount', price: 100, species: 'clownfish', sold: false };
    expect(t.sim.price({ type: 'buySpecial' })).toBe(100);
    expect(t.sim.act({ type: 'buySpecial' }).ok).toBe(true);
    expect(t.sim.act({ type: 'buySpecial' })).toEqual({ ok: false, reason: 'soldOut' });
    expect(t.sim.price({ type: 'levelFish', fishId: c, times: 10 })).toBeCloseTo(0.7 * 500 * (1.15 ** 11 - 1.15) / 0.15, 4);
    t.sim.act({ type: 'levelFish', fishId: c, times: 10 });
    expect(t.sim.price({ type: 'levelFish', fishId: c, times: 1 })).toBeCloseTo(500 * 1.15 ** 11, 4);

    m.special = { kind: 'shinyEgg', price: 100, sold: false };
    expect(t.sim.act({ type: 'buySpecial', target: 'mudskipper' })).toEqual({ ok: false, reason: 'unavailable' });
    expect(t.sim.act({ type: 'buySpecial', target: 'clownfish' }).ok).toBe(true);
    t.sim.act({ type: 'buySlot', carId: h });
    const c2 = addFish(t, 'clownfish');
    expect(t.ctx.state.fish[c2]!.shiny).toBe(true);
    expect(t.ctx.state.shinyEggs.species).toEqual([]);

    m.special = { kind: 'freeSlot', price: 100, sold: false };
    const slots = t.ctx.state.carriages[0]!.slots;
    expect(t.sim.act({ type: 'buySpecial', target: h }).ok).toBe(true);
    expect(t.ctx.state.carriages[0]!.slots).toBe(slots + 1);

    m.special = { kind: 'cosmetic', price: 100, cosmetic: 'backdrop_reef_2', sold: false };
    expect(t.sim.act({ type: 'buySpecial' }).ok).toBe(true);
    expect(t.ctx.state.permanent.unlockedCosmetics).toContain('backdrop_reef_2');
    expect(t.sim.act({ type: 'setCosmetic', carId: h, kind: 'backdrop', value: 'backdrop_reef_2' }).ok).toBe(true);
  });

  it('rolled specials are valid for the current state', () => {
    const t = make(5);
    give(t, 1e9);
    addFish(t, 'pebble_damsel');
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) {
      t.sim.advance(51);
      const sp = t.ctx.state.market.special!;
      kinds.add(sp.kind);
      if (sp.kind === 'levelDiscount') expect(t.ctx.state.copiesOwned[sp.species!]).toBeGreaterThan(0);
      if (sp.kind === 'cosmetic') expect(t.ctx.state.permanent.unlockedCosmetics).not.toContain(sp.cosmetic);
    }
    expect(kinds.size).toBe(4);
  });
});
