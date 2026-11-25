import { describe, expect, it } from 'vitest';
import { clampScale, depthLook, FLOOR_N, FRONT_N, isWallDecor, restingY, snapPlacement } from '../../../src/render/tank/layout';

describe('tank placement rules', () => {
  it('snaps low drops to the front band, floor drops to the floor line, high drops to the wall', () => {
    expect(snapPlacement(0.5, 0.02)).toEqual({ x: 0.5, y: FRONT_N, layer: 'front' });
    expect(snapPlacement(0.5, FLOOR_N + 0.05)).toEqual({ x: 0.5, y: FLOOR_N, layer: 'back' });
    const wall = snapPlacement(0.3, 0.6, true);
    expect(wall.layer).toBe('back');
    expect(wall.y).toBeCloseTo(0.6);
  });
  it('floor decor dropped mid-water snaps down to the sand line (QA bug 11)', () => {
    expect(snapPlacement(0.4, 0.6)).toEqual({ x: 0.4, y: FLOOR_N, layer: 'back' });
    expect(snapPlacement(0.4, 0.99, false).y).toBe(FLOOR_N);
    expect(isWallDecor('wren_photo')).toBe(true);
    expect(isWallDecor('sea_glass')).toBe(false);
    expect(restingY('sea_glass', 0.6)).toBe(FLOOR_N);
    expect(restingY('sea_glass', FRONT_N)).toBe(FRONT_N);
    expect(restingY('wren_photo', 0.6)).toBe(0.6);
  });
  it('keeps x inside the glass and clamps wall height', () => {
    expect(snapPlacement(-1, 0.5).x).toBeCloseTo(0.04);
    expect(snapPlacement(2, 0.99, true).y).toBeCloseTo(0.8);
  });
  it('clamps scale to 0.8–1.2', () => {
    expect(clampScale(0.5)).toBe(0.8);
    expect(clampScale(1.5)).toBe(1.2);
    expect(clampScale(1)).toBe(1);
  });
  it('farther fish are smaller, bluer, softer', () => {
    const near = depthLook(0);
    const far = depthLook(1);
    expect(far.scale).toBeLessThan(near.scale);
    expect(far.tint).toBeGreaterThan(near.tint);
    expect(far.alpha).toBeLessThan(near.alpha);
  });
});
