import { describe, expect, it } from 'vitest';
import { DecorSteer, type Obstacle } from '../../../src/render/tank/motion/avoid';
import { makeRng } from '../../../src/render/tank/motion';

const castle: Obstacle = { x: 5, y: 2, r: 1, hide: true };
const rock: Obstacle = { x: 5, y: 2, r: 1 };

describe('DecorSteer', () => {
  it('routes the render position out of a decor circle', () => {
    const s = new DecorSteer(makeRng(1));
    let p = { x: 5.2, y: 2 };
    for (let i = 0; i < 120; i++) p = { ...s.step(1 / 60, { x: 5.2, y: 2 }, [rock], false, 0.2) };
    expect(Math.hypot(p.x - rock.x, p.y - rock.y)).toBeGreaterThan(rock.r);
  });

  it('relaxes back onto the mover path once clear', () => {
    const s = new DecorSteer(makeRng(2));
    for (let i = 0; i < 60; i++) s.step(1 / 60, { x: 5.2, y: 2 }, [rock], false);
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 600; i++) p = { ...s.step(1 / 60, { x: 1, y: 1 }, [rock], false) };
    expect(Math.abs(p.x - 1)).toBeLessThan(0.05);
    expect(Math.abs(p.y - 1)).toBeLessThan(0.05);
  });

  it('hides in a hideout for a few seconds, then comes out', () => {
    const s = new DecorSteer(makeRng(3));
    s.hideNow([castle]);
    let maxHidden = 0;
    let at = { x: 0, y: 0 };
    let t = 0;
    for (; t < 3; t += 1 / 30) {
      at = { ...s.step(1 / 30, { x: 1, y: 3 }, [castle], true) };
      maxHidden = Math.max(maxHidden, s.hidden);
    }
    expect(maxHidden).toBe(1);
    expect(Math.hypot(at.x - castle.x, at.y - castle.y)).toBeLessThan(castle.r);
    for (; t < 12; t += 1 / 30) s.step(1 / 30, { x: 1, y: 3 }, [castle], true);
    expect(s.hidden).toBe(0);
    expect(s.hiding).toBe(false);
  });

  it('never hides without a hideout', () => {
    const s = new DecorSteer(makeRng(4));
    for (let t = 0; t < 60; t += 0.1) s.step(0.1, { x: 1, y: 1 }, [rock], true);
    expect(s.hidden).toBe(0);
  });
});
