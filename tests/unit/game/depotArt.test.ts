import { describe, expect, it } from 'vitest';
import { findDoorway, findWater, isWater, opaqueBox, sidingSlots, type Rgba } from '../../../src/render/depot/depotArt';
import { farVariant } from '../../../src/render/depot/depotScene';

function img(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): Rgba {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = fill(x, y);
      data.set(c, (y * w + x) * 4);
    }
  return { data, width: w, height: h };
}

describe('T-35 depot art analysis', () => {
  it('finds the shed doorway and punches lamps painted inside it', () => {
    // 120×90 keyed sprite: transparent margin, cream wall, dark arched door x 40..79, y 35..84
    const shed = img(120, 90, (x, y) => {
      if (x < 5 || x > 114 || y < 4 || y > 84) return [200, 200, 200, 0];
      const inDoor = x >= 40 && x < 80 && y >= 35 && y <= 84 && (y >= 45 || Math.hypot(x - 59.5, y - 45) < 20);
      if (inDoor && x === 60 && y === 60) return [240, 200, 90, 255]; // lamp inside the opening
      if (inDoor) return [30, 28, 34, 255];
      if (x > 100 && y < 20) return [20, 20, 20, 255]; // small dark window (not the door)
      return [230, 220, 190, 255];
    });
    const d = findDoorway(shed);
    expect(d).not.toBeNull();
    expect(d!.rect.x).toBe(40);
    expect(d!.rect.w).toBe(40);
    expect(d!.rect.y + d!.rect.h - 1).toBe(84);
    expect(d!.rect.h).toBeGreaterThanOrEqual(45);
    // the lamp pixel is filled into the punch mask, wall pixels are not
    expect(d!.mask[60 * 120 + 60]).toBe(1);
    expect(d!.mask[60 * 120 + 30]).toBe(0);
    expect(opaqueBox(shed)).toEqual({ x: 5, y: 4, w: 110, h: 81 });
  });

  it('returns null when there is no doorway', () => {
    expect(findDoorway(img(40, 40, () => [220, 220, 220, 255]))).toBeNull();
  });

  it('finds the water band of the pool and an inner rectangle that is all water', () => {
    // stone rim around an ellipse of sea water, a lily pad on it
    const pool = img(200, 100, (x, y) => {
      const e = ((x - 100) / 90) ** 2 + ((y - 55) / 35) ** 2;
      if (e > 1.15) return [0, 0, 0, 0];
      if (e > 1) return [140, 130, 115, 255];
      if (Math.hypot(x - 70, y - 50) < 4) return [90, 150, 60, 255];
      return [60, 170, 180, 255];
    });
    const w = findWater(pool);
    expect(w).not.toBeNull();
    const r = w!.inner;
    // every pixel of the inner rect is inside the ellipse
    for (const [x, y] of [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]] as const)
      expect(((x - 100) / 90) ** 2 + ((y - 55) / 35) ** 2).toBeLessThan(1);
    expect(r.w).toBeGreaterThan(80);
    expect(r.h).toBeGreaterThan(25);
    expect(isWater(140, 130, 115, 255)).toBe(false);
    expect(isWater(60, 170, 180, 255)).toBe(true);
  });

  it('stacks siding cars against the buffer without overlap', () => {
    const s = sidingSlots(-10, 2.77, 0.12, 3);
    expect(s[0]! - 2.77 / 2).toBeGreaterThanOrEqual(-10);
    expect(s[1]! - s[0]!).toBeCloseTo(2.89, 5);
  });

  it('maps the day phase to the far-scenery variant', () => {
    expect(farVariant(undefined)).toBe('day');
    expect(farVariant(0)).toBe('morning');
    expect(farVariant(0.25)).toBe('day');
    expect(farVariant(0.5)).toBe('dusk');
    expect(farVariant(0.75)).toBe('night');
  });
});
