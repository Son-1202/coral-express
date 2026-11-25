import { describe, expect, it } from 'vitest';
import { anchorBottom, bottomVisibleY, fitRepeat, hash01, slotPlacements } from '../../../src/render/diorama/foreFit';
import { WORLD } from '../../../src/render/diorama/config';

describe('T-32 foreground art layout', () => {
  it('fitRepeat uses whole repeats so 24-unit strip tiles join seamlessly', () => {
    // trackbed 2372×1344 on the 2.3-deep bed → ~4 units per image → 6 repeats
    const bed = fitRepeat(24, 2372, 1344, 2.3);
    expect(bed.repeat).toBe(6);
    expect(bed.tileW * bed.repeat).toBeCloseTo(24, 9);
    // wall 2560×621 at 1 unit tall
    const wall = fitRepeat(24, 2560, 621, 1);
    expect(Number.isInteger(wall.repeat)).toBe(true);
    expect(wall.tileH).toBeGreaterThan(0.85);
    expect(wall.tileH).toBeLessThan(1.15);
    // never below one repeat, even for a very wide image / degenerate input
    expect(fitRepeat(24, 100000, 10, 1).repeat).toBe(1);
    expect(fitRepeat(24, 0, 0, 1).repeat).toBeGreaterThanOrEqual(1);
  });

  it('anchorBottom puts the given image row on the given height', () => {
    const h = 2.16;
    const b = anchorBottom(h, 0.285, -0.9);
    // row 0.285 from the top sits (1 − 0.285)·h above the bottom
    expect(b + (1 - 0.285) * h).toBeCloseTo(-0.9, 9);
  });

  it('slot placement is deterministic, endless and inside its slot', () => {
    const spec = { slot: 4.2, chance: 0.8, zMin: 7.2, zMax: 7.8, jitter: 0.15, salt: 71 };
    const a = slotPlacements(1, spec, -30, 30, 3);
    const b = slotPlacements(1, spec, -30, 30, 3);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(5);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(p.slotIndex * spec.slot);
      expect(p.x).toBeLessThan((p.slotIndex + 1) * spec.slot);
      expect(p.z).toBeGreaterThanOrEqual(spec.zMin);
      expect(p.z).toBeLessThanOrEqual(spec.zMax);
      expect(p.kind).toBeGreaterThanOrEqual(0);
      expect(p.kind).toBeLessThan(3);
      expect(p.scale).toBeGreaterThanOrEqual(0.85);
      expect(p.scale).toBeLessThanOrEqual(1.15);
    }
    // a sub-range sees the very same sprites (stable while scrolling)
    const sub = slotPlacements(1, spec, 0, 10, 3);
    for (const p of sub) expect(a).toContainEqual(p);
    // lines differ
    expect(slotPlacements(2, spec, -30, 30, 3)).not.toEqual(a);
    expect(slotPlacements(1, spec, 0, 10, 0)).toEqual([]);
  });

  it('hash01 stays in [0, 1)', () => {
    for (let k = -50; k < 50; k++) {
      const v = hash01(3, k, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('the meadow skirt reaches below the frame at the Whale zoom-out', () => {
    // camera at zoom 1.3 (sights.ts whale) — skirt bottom must stay below the lowest visible point at the fence depth
    const d = WORLD.camDist * 1.3;
    const tilt = (WORLD.camTiltDeg * Math.PI) / 180;
    const camY = WORLD.focusY + 0.3 * 2.2 + Math.sin(tilt) * d;
    const camZ = Math.cos(tilt) * d;
    const low = bottomVisibleY(camY, camZ, 3.6, WORLD.fov, WORLD.camTiltDeg);
    const groundBottom = anchorBottom(fitRepeat(24, 2560, 920, 0.6 / 0.285).tileH, 0.285, WORLD.nearGroundY);
    expect(groundBottom - 10).toBeLessThan(low);
  });
});
