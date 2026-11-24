import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addFish, give, heritage, make } from './helpers';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('sim purity', () => {
  it('src/sim has no DOM / Three / window / wall-clock / JSON imports', () => {
    const src = files(join(__dirname, '../../../src/sim')).filter((f) => f.endsWith('.ts'));
    expect(src.length).toBeGreaterThan(5);
    for (const f of src) {
      const code = readFileSync(f, 'utf8');
      expect(code, f).not.toMatch(/from\s+['"](three|postprocessing|howler)/);
      expect(code, f).not.toMatch(/\b(window|document|localStorage|navigator|requestAnimationFrame)\b/);
      expect(code, f).not.toMatch(/Math\.random|Date\.now|performance\.now/);
      expect(code, f).not.toMatch(/from\s+['"][^'"]*(render|ui)\//);
      expect(code, f).not.toMatch(/from\s+['"][^'"]+\.json['"]/);
    }
  });
});

describe('frenzy', () => {
  it('×3 for 10 s, 30 s cooldown, frenzyEnd event', () => {
    const t = make();
    const h = heritage(t);
    addFish(t, 'pebble_damsel', h);
    t.ctx.state.shells = 0;
    expect(t.sim.act({ type: 'feed', carId: h }).ok).toBe(true);
    expect(t.sim.stats().fishSps).toBeCloseTo(1.5);
    t.sim.advance(10);
    expect(t.ctx.state.shells).toBeCloseTo(15);
    expect(t.sim.drainEvents().some((e) => e.type === 'frenzyEnd')).toBe(true);
    expect(t.sim.stats().fishSps).toBeCloseTo(0.5);
    expect(t.sim.act({ type: 'feed', carId: h })).toEqual({ ok: false, reason: 'cooldown' });
    expect(t.sim.carInfo(h).frenzyReadyIn).toBeCloseTo(20);
    t.sim.advance(20);
    expect(t.sim.act({ type: 'feed', carId: h }).ok).toBe(true);
  });
});

describe('decor + cosmetics', () => {
  it('capacity, tray copies, move/remove, price ×3 per copy', () => {
    const t = make();
    const h = heritage(t);
    give(t, 1e7);
    const place = { type: 'placeDecor' as const, carId: h, decorId: 'coral_castle', x: 0.5, y: 0.9, layer: 'back' as const, scale: 1, flip: false };
    expect(t.sim.act(place)).toEqual({ ok: false, reason: 'noCopy' });
    expect(t.sim.price({ type: 'buyDecor', decorId: 'coral_castle' })).toBe(40000);
    t.sim.act({ type: 'buyDecor', decorId: 'coral_castle' });
    expect(t.sim.price({ type: 'buyDecor', decorId: 'coral_castle' })).toBe(120000);
    t.sim.act({ type: 'buyDecor', decorId: 'coral_castle' });
    t.sim.act({ type: 'buyDecor', decorId: 'coral_castle' });
    expect(t.sim.act(place).ok).toBe(true);
    expect(t.sim.act(place).ok).toBe(true);
    expect(t.sim.act(place)).toEqual({ ok: false, reason: 'noCapacity' });
    expect(t.sim.act({ type: 'moveDecor', carId: h, index: 1, x: 2, scale: 5, flip: true }).ok).toBe(true);
    const d = t.ctx.state.carriages[0]!.decor[1]!;
    expect([d.x, d.scale, d.flip]).toEqual([1, 1.2, true]);
    expect(t.sim.act({ type: 'removeDecor', carId: h, index: 0 }).ok).toBe(true);
    expect(t.sim.carInfo(h).appeal).toBe(10);
    expect(t.sim.act({ type: 'buyDecor', decorId: 'wren_photo' })).toEqual({ ok: false, reason: 'unavailable' });
    expect(t.sim.act({ type: 'buyDecor', decorId: 'kelp_strand' })).toEqual({ ok: false, reason: 'unavailable' });
    expect(t.sim.act({ type: 'buyDecor', decorId: 'reef_2' }).ok).toBe(true); // plain plant sprite
  });

  it('cosmetics validate ids, habitat and unlocks', () => {
    const t = make();
    const h = heritage(t);
    expect(t.sim.act({ type: 'setCosmetic', carId: h, kind: 'paint', value: 'paint_navy' }).ok).toBe(true);
    expect(t.sim.act({ type: 'setCosmetic', carId: h, kind: 'sand', value: 'nope' })).toEqual({ ok: false, reason: 'unknownCosmetic' });
    expect(t.sim.act({ type: 'setCosmetic', carId: h, kind: 'backdrop', value: 'backdrop_kelp_0' })).toEqual({ ok: false, reason: 'invalid' });
    expect(t.sim.act({ type: 'setCosmetic', carId: h, kind: 'backdrop', value: 'backdrop_reef_1' })).toEqual({ ok: false, reason: 'locked' });
    t.ctx.state.permanent.unlockedCosmetics.push('backdrop_reef_1');
    expect(t.sim.act({ type: 'setCosmetic', carId: h, kind: 'backdrop', value: 'backdrop_reef_1' }).ok).toBe(true);
  });
});

describe('stats', () => {
  it('fareSps = average fare per arrival / (leg + stop)', () => {
    const t = make();
    addFish(t, 'pebble_damsel');
    const s = t.sim.stats();
    expect(s.farePerArrival).toBeCloseTo(8 * (1 + 1.4) / 2);
    expect(s.fareSps).toBeCloseTo(s.farePerArrival / 51);
    expect(s.totalSps).toBeCloseTo(0.5 + s.fareSps);
  });
});
