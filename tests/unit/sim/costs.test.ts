import { describe, expect, it } from 'vitest';
import { carriagePrice, copyCost, habitatChangeCost, levelCost, levelsCost, milestoneMult, slotCost, trackCost } from '../../../src/sim/costs';
import { addCar, addFish, give, heritage, make, unlock } from './helpers';

describe('cost formulas', () => {
  const { ctx } = make();
  const idx = ctx.idx;

  it('track: trackBase × 8^(k-2)', () => {
    expect(trackCost(idx, 1, 3)).toBe(960);
    expect(trackCost(idx, 1, 6)).toBe(120 * 8 ** 4);
    expect(trackCost(idx, 2, 3)).toBe(2.4e7);
  });
  it('carriage n: 400 × 5^(n-2) × fareMult', () => {
    expect(carriagePrice(idx, 1, 2)).toBe(400);
    expect(carriagePrice(idx, 1, 3)).toBe(2000);
    expect(carriagePrice(idx, 2, 2)).toBe(10000);
    expect(carriagePrice(idx, 3, 4)).toBe(400 * 25 * 600);
  });
  it('slot: 0.5 × carriagePrice × 2^extra; habitat change 20%', () => {
    expect(slotCost(idx, 1, 2, 0)).toBe(200);
    expect(slotCost(idx, 1, 2, 2)).toBe(800);
    expect(habitatChangeCost(idx, 1, 2)).toBe(80);
  });
  it('level: baseCost × 1.15^level; milestones ×2 at 10/25/50', () => {
    expect(levelCost(idx, 500, 1)).toBeCloseTo(575, 9);
    expect(levelsCost(idx, 500, 1, 3)).toBeCloseTo(575 + 661.25 + 760.4375, 6);
    expect(milestoneMult(idx, 9)).toBe(1);
    expect(milestoneMult(idx, 10)).toBe(2);
    expect(milestoneMult(idx, 25)).toBe(4);
    expect(milestoneMult(idx, 50)).toBe(8);
  });
  it('copy cost: baseCost × 1.5^copies; first damsel free', () => {
    const t = make();
    const h = heritage(t);
    const damsel = t.ctx.idx.species.get('pebble_damsel')!;
    expect(copyCost(t.ctx.idx, t.ctx.state, damsel, t.ctx.fx())).toBe(0);
    addFish(t, 'pebble_damsel', h);
    expect(t.sim.price({ type: 'buyFish', species: 'pebble_damsel', carId: h })).toBe(15);
    unlock(t, 'clownfish');
    addFish(t, 'clownfish', h);
    addFish(t, 'clownfish', h);
    const c2 = addCar(t, 'reef');
    expect(t.sim.price({ type: 'buyFish', species: 'clownfish', carId: c2 })).toBeCloseTo(1125, 9);
  });
  it('fishmonger upgrade: species −25%', () => {
    const t = make();
    t.ctx.state.permanent.upgrades.push('fishmonger');
    t.ctx.invalidate();
    unlock(t, 'clownfish');
    expect(t.sim.price({ type: 'buyFish', species: 'clownfish', carId: heritage(t) })).toBe(375);
  });
});

describe('purchases through act()', () => {
  it('charges, refuses when broke, sells for 50% of spend', () => {
    const t = make();
    const h = heritage(t);
    expect(t.ctx.state.shells).toBe(150);
    unlock(t, 'clownfish');
    expect(t.sim.act({ type: 'buyFish', species: 'clownfish', carId: h })).toEqual({ ok: false, reason: 'cantAfford' });
    const f = addFish(t, 'clownfish', h);
    give(t, 575);
    expect(t.sim.act({ type: 'levelFish', fishId: f, times: 1 }).ok).toBe(true);
    expect(t.ctx.state.fish[f]!.spent).toBeCloseTo(1075, 9);
    const before = t.ctx.state.shells;
    expect(t.sim.price({ type: 'sellFish', fishId: f })).toBeCloseTo(-537.5, 9);
    t.sim.act({ type: 'sellFish', fishId: f });
    expect(t.ctx.state.shells - before).toBeCloseTo(537.5, 9);
    expect(t.ctx.state.copiesOwned['clownfish']).toBe(0);
  });
  it('level max buys as many as affordable, emits milestone', () => {
    const t = make();
    const f = addFish(t, 'pebble_damsel');
    t.ctx.state.shells = levelsCost(t.ctx.idx, 10, 1, 9) + 1;
    t.sim.drainEvents();
    expect(t.sim.act({ type: 'levelFish', fishId: f, times: 'max' }).ok).toBe(true);
    expect(t.ctx.state.fish[f]!.level).toBe(10);
    const ev = t.sim.drainEvents();
    expect(ev.some((e) => e.type === 'milestone' && e.level === 10)).toBe(true);
    t.ctx.state.shells = 0;
    expect(t.sim.act({ type: 'levelFish', fishId: f, times: 'max' })).toEqual({ ok: false, reason: 'cantAfford' });
  });
  it('enforces slots, max carriages, max slots, track end', () => {
    const t = make();
    const h = heritage(t);
    for (let i = 0; i < 3; i++) addFish(t, 'pebble_damsel', h);
    give(t, 1e6);
    expect(t.sim.act({ type: 'buyFish', species: 'pebble_damsel', carId: h })).toEqual({ ok: false, reason: 'noSlot' });
    give(t, 1e12);
    for (let i = 0; i < 3; i++) expect(t.sim.act({ type: 'buySlot', carId: h }).ok).toBe(true);
    expect(t.sim.act({ type: 'buySlot', carId: h })).toEqual({ ok: false, reason: 'maxSlots' });
    for (let i = 0; i < 7; i++) expect(t.sim.act({ type: 'buyCarriage', habitat: 'reef' }).ok).toBe(true);
    expect(t.sim.act({ type: 'buyCarriage', habitat: 'reef' })).toEqual({ ok: false, reason: 'maxCarriages' });
    expect(t.sim.act({ type: 'buyCarriage', habitat: 'kelp' })).toEqual({ ok: false, reason: 'maxCarriages' });
    for (let i = 0; i < 4; i++) expect(t.sim.act({ type: 'buildTrack' }).ok).toBe(true);
    expect(t.sim.act({ type: 'buildTrack' })).toEqual({ ok: false, reason: 'trackComplete' });
  });
  it('locks habitats of unopened lines and first sale to home market', () => {
    const t = make();
    give(t, 1e6);
    expect(t.sim.act({ type: 'buyCarriage', habitat: 'kelp' })).toEqual({ ok: false, reason: 'habitatLocked' });
    expect(t.sim.act({ type: 'buyFish', species: 'clownfish', carId: heritage(t) })).toEqual({ ok: false, reason: 'unavailable' });
    expect(t.sim.act({ type: 'buyFish', species: 'carpet_anemone', carId: heritage(t) })).toEqual({ ok: false, reason: 'unavailable' });
    t.sim.advance(51); // arrive at station 2
    expect(t.ctx.state.marketStation).toBe(2);
    expect(t.sim.act({ type: 'buyFish', species: 'carpet_anemone', carId: heritage(t) }).ok).toBe(true);
  });
  it('habitat change costs 20% and resets the backdrop', () => {
    const t = make();
    const h = heritage(t);
    expect(t.sim.price({ type: 'changeHabitat', carId: h, habitat: 'mangrove' })).toBe(16);
    give(t, 16);
    expect(t.sim.act({ type: 'changeHabitat', carId: h, habitat: 'mangrove' }).ok).toBe(true);
    expect(t.ctx.state.carriages[0]!.cosmetics.backdrop).toBe('backdrop_mangrove_0');
  });
});
