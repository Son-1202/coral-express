import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../../src/sim';
import { updateRequests } from '../../../src/sim/requests';
import { addFish, give, heritage, make, noSights, stock } from './helpers';

const done = (ev: SimEvent[]) => ev.filter((e): e is Extract<SimEvent, { type: 'requestCompleted' }> => e.type === 'requestCompleted');

describe('passenger requests', () => {
  it('board: station-specific first, then line-wide; shown in the market', () => {
    const t = make(1, true);
    expect(t.ctx.state.requestBoards['l1s1']!.ids).toEqual(['r_l1_01', 'r_l1_04', 'r_l1_08']);
    expect(t.ctx.state.market.requests).toEqual(['r_l1_01', 'r_l1_04', 'r_l1_08']);
    t.sim.advance(51);
    expect(t.ctx.state.requestBoards['l1s2']!.ids).toEqual(['r_l1_02']); // line-wide ones already on l1s1
  });

  it('completes on arrival at that station when met → income reward + event; history survives reset', () => {
    const t = make(1, true);
    noSights(t);
    const h = heritage(t);
    addFish(t, 'pebble_damsel', h);
    const s0 = t.sim.stats();
    const expected = 180 * (s0.fishSps + s0.fareSps);
    t.sim.drainEvents();
    t.sim.advance(51 * 2); // → station 2 → station 1
    const ev = done(t.sim.drainEvents());
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ requestId: 'r_l1_01', stationId: 'l1s1', passenger: 'Pia', carId: h, rewardType: 'income' });
    expect(ev[0]!.shells).toBeCloseTo(expected, 6);
    expect(t.ctx.state.lifetime.requestShells).toBeCloseTo(expected, 6);
    expect(t.ctx.state.lifetime.requestsCompleted).toBe(1);
    expect(t.ctx.state.permanent.requestHistory).toEqual(['r_l1_01']);
    t.ctx.state.runShells = 1e6;
    t.ctx.state.terminalReachedThisRun = true;
    expect(t.sim.act({ type: 'depotReset', mascotFishId: Object.keys(t.ctx.state.fish)[0]!, nextLine: 1 }).ok).toBe(true);
    expect(t.ctx.state.requestBoards['l1s1']!.ids).not.toContain('r_l1_01');
    expect(t.ctx.state.permanent.requestHistory).toEqual(['r_l1_01']);
  });

  it('decor / cosmetic / shiny egg rewards; refresh after 2 visits', () => {
    const t = make(1, true);
    const h = heritage(t);
    const s = t.ctx.state;
    give(t, 1e9);
    stock(t, 'reef_2', 'seagrass_tuft');
    for (const id of ['reef_2', 'seagrass_tuft']) {
      t.sim.act({ type: 'buyDecor', decorId: id });
      t.sim.act({ type: 'placeDecor', carId: h, decorId: id, x: 0.5, y: 0.9, layer: 'back', scale: 1, flip: false });
    }
    s.requestBoards['l1s5'] = { ids: ['r_l1_06', 'r_l1_05'], visits: 1 };
    updateRequests(t.ctx, 'l1s5', true);
    expect(s.decorOwned['treasure_chest']).toBe(1); // r_l1_06: 2 plants → chest
    expect(s.requestBoards['l1s5']).toEqual({ ids: ['r_l1_05'], visits: 2 });
    updateRequests(t.ctx, 'l1s5', true); // 3rd visit → rebuilt
    expect(s.requestBoards['l1s5']!.visits).toBe(1);
    expect(s.requestBoards['l1s5']!.ids).not.toContain('r_l1_06');
    // community → income + cosmetic
    addFish(t, 'pebble_damsel', h);
    addFish(t, 'carpet_anemone', h);
    addFish(t, 'clownfish', h);
    s.requestBoards['l1s4'] = { ids: ['r_l1_05', 'r_l1_08'], visits: 1 };
    s.fish[s.carriages[0]!.fish[0]!]!.shiny = true;
    t.sim.drainEvents();
    updateRequests(t.ctx, 'l1s4', true);
    expect(done(t.sim.drainEvents()).map((e) => e.requestId)).toEqual(['r_l1_05', 'r_l1_08']);
    expect(s.permanent.unlockedCosmetics).toContain('paint_red');
    expect(s.shinyEggs.any).toBe(1);
  });

  it('without story data there are no requests', () => {
    const t = make(1);
    expect(t.ctx.state.market.requests).toEqual([]);
  });
});

describe('lifetime stats', () => {
  it('fish shells by species sum to fish income; sources tracked', () => {
    const t = make();
    noSights(t);
    addFish(t, 'pebble_damsel');
    addFish(t, 'carpet_anemone');
    t.sim.advance(120);
    const s = t.ctx.state;
    const sum = Object.values(s.speciesShells).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(s.lifetime.fishShells, 6);
    expect(s.speciesShells['carpet_anemone']).toBeGreaterThan(s.speciesShells['pebble_damsel']!);
    expect(s.lifetime.shellsEarned).toBeCloseTo(s.lifetime.fishShells + s.lifetime.fareShells, 6);
    expect(s.lifetime.playSeconds).toBe(120);
  });
});
