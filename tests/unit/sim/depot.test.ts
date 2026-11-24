import { describe, expect, it } from 'vitest';
import type { SimInternals } from '../../../src/sim';
import { addCar, addFish, give, heritage, make, noSights, stock } from './helpers';

function ready(t: SimInternals, runShells = 1e6): void {
  t.ctx.state.runShells = runShells;
  t.ctx.state.terminalReachedThisRun = true;
}

describe('depot reset', () => {
  it('tickets = floor(sqrt(runShells / 1e5)): 1M→3, 4M→6, 25M→15; needs 1M + terminal', () => {
    const t = make();
    t.ctx.state.runShells = 4e6;
    expect(t.sim.projectedTickets()).toBe(6);
    expect(t.sim.canDepotReset()).toBe(false); // no terminal yet
    t.ctx.state.runShells = 25e6;
    expect(t.sim.projectedTickets()).toBe(15);
    ready(t, 999_999);
    expect(t.sim.canDepotReset()).toBe(false);
    ready(t, 1e6);
    expect(t.sim.projectedTickets()).toBe(3);
    expect(t.sim.canDepotReset()).toBe(true);
    const f = addFish(t, 'pebble_damsel');
    expect(t.sim.act({ type: 'depotReset', mascotFishId: f, nextLine: 2 })).toEqual({ ok: false, reason: 'locked' });
    expect(t.sim.act({ type: 'depotReset', mascotFishId: 'nope', nextLine: 1 })).toEqual({ ok: false, reason: 'unknownFish' });
    t.ctx.state.terminalReachedThisRun = false;
    expect(t.sim.act({ type: 'depotReset', mascotFishId: f, nextLine: 1 })).toEqual({ ok: false, reason: 'notReady' });
  });

  it('resets the run, keeps permanent block, Heritage layout and the Mascot at level 5', () => {
    const t = make();
    noSights(t);
    const h = heritage(t);
    give(t, 1e9);
    expect(t.sim.act({ type: 'changeHabitat', carId: h, habitat: 'mangrove' }).ok).toBe(true);
    t.sim.act({ type: 'setCosmetic', carId: h, kind: 'paint', value: 'paint_navy' });
    stock(t, 'treasure_chest');
    t.sim.act({ type: 'buyDecor', decorId: 'treasure_chest' });
    t.sim.act({ type: 'placeDecor', carId: h, decorId: 'treasure_chest', x: 0.3, y: 0.9, layer: 'back', scale: 1, flip: false });
    t.sim.act({ type: 'buySlot', carId: h });
    const c = addFish(t, 'clownfish', h);
    t.sim.act({ type: 'levelFish', fishId: c, times: 11 });
    addCar(t, 'reef');
    t.sim.act({ type: 'buildTrack' });
    t.ctx.state.permanent.openedLines.push(2);
    t.ctx.state.permanent.stamps.push('station:l1s6');
    ready(t, 1e6);
    t.sim.drainEvents();
    expect(t.sim.act({ type: 'depotReset', mascotFishId: c, mascotName: 'Bubbles', nextLine: 2 }).ok).toBe(true);
    const ev = t.sim.drainEvents();
    expect(ev.find((e) => e.type === 'depotReset')).toMatchObject({ tickets: 3, line: 2, mascotSpecies: 'clownfish' });
    const s = t.ctx.state;
    expect(s.permanent.tickets).toBe(3);
    expect(s.permanent.totalTicketsEarned).toBe(3);
    expect(s.permanent.resets).toBe(1);
    expect(s.permanent.stamps).toContain('station:l1s6');
    expect(s.currentLine).toBe(2);
    expect(s.builtTo).toBe(2);
    expect(s.runShells).toBe(0);
    expect(s.shells).toBe(150);
    expect(s.carriages).toHaveLength(1);
    const hc = s.carriages[0]!;
    expect(hc.id).toBe(h);
    expect(hc.habitat).toBe('mangrove');
    expect(hc.cosmetics.paint).toBe('paint_navy');
    expect(hc.decor.map((d) => d.id)).toEqual(['treasure_chest']);
    expect(hc.slots).toBe(3); // extra slot gone (start slots cap)
    expect(hc.fish).toHaveLength(1);
    const m = s.fish[hc.fish[0]!]!;
    expect(m).toMatchObject({ species: 'clownfish', level: 5, mascot: true, nickname: 'Bubbles' });
    expect(t.sim.carInfo(h).fish[0]!.habitatMult).toBe(1); // ignores habitat penalty
    expect(s.permanent.mascot).toEqual({ species: 'clownfish', shiny: false, nickname: 'Bubbles' });
    expect(s.market.stationId).toBe('l2s1');
  });

  it('Old Friend: same Mascot species 3 resets in a row → +25% output', () => {
    const t = make();
    noSights(t);
    for (let i = 0; i < 3; i++) {
      expect(t.ctx.state.permanent.oldFriend).toBe(false);
      const fid = Object.keys(t.ctx.state.fish)[0] ?? addFish(t, 'pebble_damsel');
      ready(t);
      expect(t.sim.act({ type: 'depotReset', mascotFishId: fid, nextLine: 1 }).ok).toBe(true);
    }
    expect(t.ctx.state.permanent.oldFriendStreak).toBe(3);
    expect(t.ctx.state.permanent.oldFriend).toBe(true);
    // damsel lvl 5 × ticketMult (1 + 0.1 × 9) × 1.25
    expect(t.sim.stats().fishSps).toBeCloseTo(0.5 * 5 * 1.9 * 1.25);
    // a different species restarts the streak (Old Friend stays)
    const f = addFish(t, 'carpet_anemone');
    ready(t);
    t.sim.act({ type: 'depotReset', mascotFishId: f, nextLine: 1 });
    expect(t.ctx.state.permanent.oldFriendStreak).toBe(1);
    expect(t.ctx.state.permanent.oldFriend).toBe(true);
  });
});

describe('depot upgrades', () => {
  it('cost Tickets, each once', () => {
    const t = make();
    expect(t.sim.act({ type: 'buyUpgrade', id: 'season_pass' })).toEqual({ ok: false, reason: 'cantAfford' });
    t.ctx.state.permanent.tickets = 3;
    expect(t.sim.act({ type: 'buyUpgrade', id: 'season_pass' }).ok).toBe(true);
    expect(t.ctx.state.permanent.tickets).toBe(1);
    t.ctx.state.permanent.tickets = 10;
    expect(t.sim.act({ type: 'buyUpgrade', id: 'season_pass' })).toEqual({ ok: false, reason: 'owned' });
    expect(t.sim.act({ type: 'buyUpgrade', id: 'nope' })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('every upgrade applies its effect', () => {
    const buy = (t: SimInternals, id: string): void => {
      t.ctx.state.permanent.tickets += 10;
      expect(t.sim.act({ type: 'buyUpgrade', id }).ok).toBe(true);
    };
    // season_pass: offline 12 h @ 70%
    let t = make();
    noSights(t);
    addFish(t, 'pebble_damsel');
    buy(t, 'season_pass');
    const total = 0.5 + t.sim.stats().fareSps;
    t.ctx.state.shells = 0;
    expect(t.sim.advanceOffline(20 * 3600)).toMatchObject({ seconds: 12 * 3600 });
    expect(t.ctx.state.shells).toBeCloseTo(0.7 * total * 12 * 3600, 3);
    // spare_change: next run starts with 150 + 500 × totalTicketsEarned
    t = make();
    buy(t, 'spare_change');
    t.ctx.state.permanent.totalTicketsEarned = 4;
    ready(t);
    t.sim.act({ type: 'depotReset', mascotFishId: addFish(t, 'pebble_damsel'), nextLine: 1 });
    expect(t.ctx.state.shells).toBe(150 + 500 * (4 + 3));
    // express_engine: 30 s legs
    t = make();
    buy(t, 'express_engine');
    t.sim.drainEvents();
    t.sim.advance(36);
    expect(t.sim.drainEvents().some((e) => e.type === 'arrive')).toBe(true);
    // fishmonger: −25% species purchase price
    t = make();
    buy(t, 'fishmonger');
    t.ctx.state.speciesBoughtThisRun.push('clownfish');
    expect(t.sim.price({ type: 'buyFish', species: 'clownfish', carId: heritage(t) })).toBe(375);
    // double_decker: 5 slots for existing and new carriages
    t = make();
    buy(t, 'double_decker');
    expect(t.ctx.state.carriages[0]!.slots).toBe(5);
    const nc = addCar(t, 'reef');
    expect(t.ctx.state.carriages.find((c) => c.id === nc)!.slots).toBe(5);
    // brass_bell: tested in sights.test.ts (interval ÷1.5)
    t = make();
    buy(t, 'brass_bell');
    expect(t.ctx.fx().sightFrequencyMult).toBe(1.5);
    // ticket_printer: fares ×2
    t = make();
    addFish(t, 'pebble_damsel');
    const fare = t.sim.stats().nextFare;
    buy(t, 'ticket_printer');
    expect(t.sim.stats().nextFare).toBeCloseTo(fare * 2);
    // matchmaker: +25 pp pairs
    t = make();
    const c = addFish(t, 'clownfish');
    addFish(t, 'carpet_anemone');
    buy(t, 'matchmaker');
    expect(t.sim.carInfo(heritage(t)).fish.find((f) => f.fishId === c)!.bondMult).toBeCloseTo(1.75);
  });
});
