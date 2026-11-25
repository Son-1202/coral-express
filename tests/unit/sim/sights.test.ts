import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../../src/sim';
import { addCar, addFish, heritage, make } from './helpers';

const ends = (ev: SimEvent[]) => ev.filter((e): e is Extract<SimEvent, { type: 'sightEnd' }> => e.type === 'sightEnd');

describe('sights', () => {
  it('first sight starts U(70,110) s in; Brass Bell ÷1.5; one at a time', () => {
    for (const bell of [false, true]) {
      for (let seed = 1; seed <= 20; seed++) {
        const t = make(seed);
        if (bell) { t.ctx.state.permanent.upgrades.push('brass_bell'); t.ctx.invalidate(); }
        let at = -1;
        for (let i = 0; i < 480 && at < 0; i++) {
          t.sim.advance(0.25);
          if (t.sim.drainEvents().some((e) => e.type === 'sightStart')) at = t.ctx.state.time;
        }
        const k = bell ? 1.5 : 1;
        expect(at).toBeGreaterThanOrEqual(70 / k - 0.01);
        expect(at).toBeLessThanOrEqual(110 / k + 0.26);
        expect(t.sim.triggerSight('sea_fog')).toBe(false); // one at a time
      }
    }
  });

  it('dolphin: tap → +60 s of fish income; untapped → nothing', () => {
    const t = make();
    addFish(t, 'pebble_damsel');
    t.ctx.state.shells = 0;
    expect(t.sim.act({ type: 'tapSight' })).toEqual({ ok: false, reason: 'noSight' });
    expect(t.sim.triggerSight('dolphin_race')).toBe(true);
    expect(t.sim.act({ type: 'tapSight' }).ok).toBe(true);
    expect(t.ctx.state.shells).toBeCloseTo(30);
    expect(t.ctx.state.lifetime.sightShells).toBeCloseTo(30);
    expect(ends(t.sim.drainEvents())[0]).toMatchObject({ sightId: 'dolphin_race', tapped: true, shells: 30 });
    t.sim.triggerSight('dolphin_race');
    t.sim.advance(8);
    expect(ends(t.sim.drainEvents())[0]).toMatchObject({ tapped: false, shells: 0 });
    expect(t.ctx.state.sight.active).toBeNull();
  });

  it('seagull: untapped after 6 s → lose 5% of Shells; tapped → no loss', () => {
    const t = make();
    t.ctx.state.shells = 1000;
    t.sim.triggerSight('seagull_thief');
    t.sim.advance(5.75);
    expect(t.ctx.state.sight.active).not.toBeNull();
    t.sim.advance(0.25);
    expect(t.ctx.state.shells).toBeCloseTo(950);
    expect(ends(t.sim.drainEvents())[0]!.shells).toBeCloseTo(-50);
    t.sim.triggerSight('seagull_thief');
    expect(t.sim.act({ type: 'tapSight' }).ok).toBe(true);
    t.sim.advance(6);
    expect(t.ctx.state.shells).toBeCloseTo(950);
  });

  it('whale breach: fish income and fares ×2 for 20 s, automatic', () => {
    const t = make();
    addFish(t, 'pebble_damsel');
    const fare = t.sim.stats().nextFare;
    t.sim.triggerSight('whale_breach');
    expect(t.sim.act({ type: 'tapSight' })).toEqual({ ok: false, reason: 'invalid' });
    expect(t.sim.stats().fishSps).toBeCloseTo(1);
    expect(t.sim.stats().nextFare).toBeCloseTo(fare * 2);
    t.ctx.state.shells = 0;
    t.sim.advance(20);
    expect(t.ctx.state.shells).toBeCloseTo(20, 5);
    expect(t.sim.stats().fishSps).toBeCloseTo(0.5);
    expect(t.ctx.state.sight.active).toBeNull();
  });

  it('festival: next arrival pays ×5, then ends', () => {
    const t = make();
    addFish(t, 'pebble_damsel');
    const fare = t.sim.stats().nextFare;
    t.sim.triggerSight('festival_station');
    expect(t.sim.stats().nextFare).toBeCloseTo(fare * 5);
    t.sim.drainEvents();
    t.sim.advance(51);
    const ev = t.sim.drainEvents();
    const paid = ev.find((e) => e.type === 'fare');
    expect(paid && paid.type === 'fare' && paid.amount).toBeCloseTo(fare * 5);
    expect(ends(ev)).toHaveLength(1);
    expect(t.sim.stats().nextFare).toBeCloseTo(1 * 0.5 * 8); // back at station 1 next
  });

  it('stowaway: tap puts a free owned-habitat fish into a free slot; needs a slot', () => {
    const t = make(3);
    const h = heritage(t);
    t.sim.triggerSight('stowaway');
    t.sim.drainEvents();
    expect(t.sim.act({ type: 'tapSight' }).ok).toBe(true);
    const e = ends(t.sim.drainEvents())[0]!;
    const f = t.ctx.state.fish[e.fishId!]!;
    expect(f.carId).toBe(h);
    expect(f.spent).toBe(0);
    expect(t.ctx.idx.species.get(f.species)!.habitat).toBe('reef');
    addFish(t, 'pebble_damsel', h);
    addFish(t, 'pebble_damsel', h);
    t.sim.triggerSight('stowaway');
    expect(t.sim.act({ type: 'tapSight' })).toEqual({ ok: false, reason: 'noSlot' });
    const m = addCar(t, 'mangrove');
    expect(t.sim.act({ type: 'tapSight' }).ok).toBe(true);
    expect(t.ctx.state.carriages.find((c) => c.id === m)!.fish).toHaveLength(1);
  });

  it('sea fog: fares ×0.5, fish ×1.5 for 30 s', () => {
    const t = make();
    addFish(t, 'pebble_damsel');
    const s0 = t.sim.stats();
    t.sim.triggerSight('sea_fog');
    const s1 = t.sim.stats();
    expect(s1.fishSps).toBeCloseTo(s0.fishSps * 1.5);
    expect(s1.farePerArrival).toBeCloseTo(s0.farePerArrival * 0.5);
    t.sim.advance(30);
    expect(t.sim.stats().fishSps).toBeCloseTo(s0.fishSps);
  });
});
