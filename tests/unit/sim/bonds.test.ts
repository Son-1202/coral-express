import { describe, expect, it } from 'vitest';
import { addCar, addFish, give, heritage, make, setLine } from './helpers';

const bm = (t: ReturnType<typeof make>, carId: string, fishId: string): number =>
  t.sim.carInfo(carId).fish.find((f) => f.fishId === fishId)!.bondMult;

describe('bonds', () => {
  it('pair: both partners get the bonus; bondFormed emitted', () => {
    const t = make();
    const h = heritage(t);
    const c = addFish(t, 'clownfish', h);
    t.sim.drainEvents();
    const a = addFish(t, 'carpet_anemone', h);
    expect(bm(t, h, c)).toBeCloseTo(1.5);
    expect(bm(t, h, a)).toBeCloseTo(1.5);
    const formed = t.sim.drainEvents().filter((e) => e.type === 'bondFormed');
    expect(formed).toHaveLength(1);
    // clownfish basePps 9 × 1.5
    expect(t.sim.carInfo(h).fish.find((f) => f.fishId === c)!.sps).toBeCloseTo(13.5);
  });

  it('a fish counts toward at most one pair (deterministic match)', () => {
    const t = make();
    const h = heritage(t);
    const c1 = addFish(t, 'clownfish', h);
    const c2 = addFish(t, 'clownfish', h);
    const a = addFish(t, 'carpet_anemone', h);
    expect(bm(t, h, c1)).toBeCloseTo(1.5);
    expect(bm(t, h, c2)).toBe(1);
    expect(bm(t, h, a)).toBeCloseTo(1.5);
    expect(t.sim.carInfo(h).activeBonds.filter((b) => b.kind === 'pair')).toHaveLength(1);
  });

  it('community: +100% to the car, +5 appeal, and still counts its pair', () => {
    const t = make();
    const h = heritage(t);
    const d = addFish(t, 'pebble_damsel', h);
    const a = addFish(t, 'carpet_anemone', h);
    const c = addFish(t, 'clownfish', h);
    expect(bm(t, h, d)).toBeCloseTo(2);
    expect(bm(t, h, a)).toBeCloseTo(2.5);
    expect(bm(t, h, c)).toBeCloseTo(2.5);
    const info = t.sim.carInfo(h);
    expect(info.appeal).toBeCloseTo(1 + 2 + 4 + 5);
    expect(info.activeBonds.map((b) => b.kind).sort()).toEqual(['community', 'pair']);
  });

  it('moving a partner away breaks the bond', () => {
    const t = make();
    const h = heritage(t);
    addFish(t, 'clownfish', h);
    const a = addFish(t, 'carpet_anemone', h);
    const r = addCar(t, 'reef');
    t.sim.drainEvents();
    expect(t.sim.act({ type: 'moveFish', fishId: a, carId: r }).ok).toBe(true);
    const ev = t.sim.drainEvents();
    expect(ev.filter((e) => e.type === 'bondBroken')).toHaveLength(1);
    expect(t.sim.carInfo(h).possibleBonds.some((p) => p.kind === 'pair' && p.missing[0] === 'carpet_anemone')).toBe(true);
  });

  it('habitat penalty halves output and appeal; mascot ignores it', () => {
    const t = make();
    const m = addCar(t, 'mangrove');
    const c = addFish(t, 'clownfish', m);
    let f = t.sim.carInfo(m).fish[0]!;
    expect(f.habitatMult).toBe(0.5);
    expect(f.sps).toBeCloseTo(4.5);
    expect(f.appeal).toBeCloseTo(2);
    t.ctx.state.fish[c]!.mascot = true;
    t.ctx.invalidate();
    f = t.sim.carInfo(m).fish[0]!;
    expect(f.habitatMult).toBe(1);
  });

  it('whale: always home, +5% to all fish per distinct species on the train', () => {
    const t = make();
    setLine(t, 3);
    const v = addCar(t, 'vent');
    const w = addFish(t, 'pocket_whale', heritage(t)); // reef car, still home
    addFish(t, 'tubeworm', v);
    const y = addFish(t, 'yeti_crab', v);
    const info = t.sim.carInfo(heritage(t));
    expect(info.fish.find((f) => f.fishId === w)!.habitatMult).toBe(1);
    // 3 distinct species → ×1.15; yeti in pair with tubeworm ×1.5
    const yeti = t.sim.carInfo(v).fish.find((f) => f.fishId === y)!;
    expect(yeti.sps).toBeCloseTo(2.0e10 * 1.5 * 1.15, -3);
  });

  it('krill counts as 2 fish for appeal; shiny ×3 appeal', () => {
    const t = make();
    setLine(t, 2);
    const p = addCar(t, 'polar');
    const k = addFish(t, 'ice_krill', p);
    expect(t.sim.carInfo(p).fish[0]!.appeal).toBe(6);
    t.ctx.state.fish[k]!.shiny = true;
    t.ctx.invalidate();
    expect(t.sim.carInfo(p).appeal).toBe(18);
  });

  it('decor: same-id effects do not stack, appeal does; Captain\'s Wheel +20pp bonds', () => {
    const t = make();
    const h = heritage(t);
    const d = addFish(t, 'pebble_damsel', h);
    give(t, 1e9);
    for (let i = 0; i < 2; i++) {
      expect(t.sim.act({ type: 'buyDecor', decorId: 'treasure_chest' }).ok).toBe(true);
      expect(t.sim.act({ type: 'placeDecor', carId: h, decorId: 'treasure_chest', x: 0.2, y: 0.9, layer: 'back', scale: 1, flip: false }).ok).toBe(true);
    }
    const info = t.sim.carInfo(h);
    expect(info.fish.find((f) => f.fishId === d)!.sps).toBeCloseTo(0.5 * 1.1);
    expect(info.appeal).toBeCloseTo(1 + 10);
    expect(info.decorUsed).toBe(4);

    const u = make();
    setLine(u, 3);
    const hu = heritage(u);
    const c = addFish(u, 'clownfish', hu);
    addFish(u, 'carpet_anemone', hu);
    give(u, 1e14);
    expect(u.sim.act({ type: 'buyDecor', decorId: 'captains_wheel' }).ok).toBe(true);
    expect(u.sim.act({ type: 'placeDecor', carId: hu, decorId: 'captains_wheel', x: 0.5, y: 0.9, layer: 'front', scale: 1, flip: false }).ok).toBe(true);
    expect(bm(u, hu, c)).toBeCloseTo(1.7);
  });

  it('matchmaker upgrade adds pp to pairs and communities', () => {
    const t = make();
    t.ctx.state.permanent.upgrades.push('matchmaker');
    t.ctx.invalidate();
    const h = heritage(t);
    const d = addFish(t, 'pebble_damsel', h);
    addFish(t, 'carpet_anemone', h);
    const c = addFish(t, 'clownfish', h);
    expect(bm(t, h, d)).toBeCloseTo(2.5);
    expect(bm(t, h, c)).toBeCloseTo(1 + 0.75 + 1.5);
  });
});
