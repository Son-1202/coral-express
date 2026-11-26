import { describe, expect, it } from 'vitest';
import { cordRow, sagPoints, spanSag } from '../../../src/render/fx/festival';

describe('T-38 festival bunting layout', () => {
  it('sagPoints starts and ends on the anchors and dips by `sag` at mid-span', () => {
    const pts = sagPoints({ x: -6, y: 1.6 }, { x: -2, y: 2.4 }, 0.3, 10);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual({ x: -6, y: 1.6 });
    expect(pts[10]?.x).toBeCloseTo(-2, 9);
    expect(pts[10]?.y).toBeCloseTo(2.4, 9);
    // mid-span: chord midpoint (2.0) minus the full sag
    expect(pts[5]?.x).toBeCloseTo(-4, 9);
    expect(pts[5]?.y).toBeCloseTo(2.0 - 0.3, 9);
    // every interior point hangs below the straight chord
    for (let i = 1; i < 10; i++) {
      const u = i / 10;
      expect(pts[i]!.y).toBeLessThan(1.6 + 0.8 * u);
    }
  });

  it('spanSag grows with span length, clamped, and scales for the flatter middle span', () => {
    expect(spanSag(0.1)).toBeGreaterThan(0);
    expect(spanSag(4)).toBeGreaterThan(spanSag(2));
    expect(spanSag(100)).toBe(spanSag(200));
    expect(spanSag(4, 0.5)).toBeCloseTo(spanSag(4) / 2, 9);
  });

  it('cordRow finds the first (almost) fully opaque row of a garland strip', () => {
    // 10×8 strip: row 0 empty, row 1 partly covered, rows 2–3 = cord, pennants below
    const a = (x: number, y: number) => (y === 1 ? (x < 5 ? 255 : 0) : y === 2 || y === 3 ? 255 : y > 3 && x % 3 === 0 ? 255 : 0);
    expect(cordRow(a, 10, 8)).toBeCloseTo(2.5 / 8, 9);
    // no cord at all → safe default near the top
    expect(cordRow(() => 0, 10, 8)).toBeCloseTo(0.1, 9);
  });
});
