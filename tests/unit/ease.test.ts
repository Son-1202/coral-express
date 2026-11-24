import { describe, expect, it } from 'vitest';
import { legProfile } from '../../src/render/anim/ease';

describe('legProfile', () => {
  it('starts at 0 and ends at 1 at rest', () => {
    expect(legProfile(0).pos).toBeCloseTo(0, 6);
    expect(legProfile(0).vel).toBeCloseTo(0, 6);
    expect(legProfile(1).pos).toBeCloseTo(1, 6);
    expect(legProfile(1).vel).toBeCloseTo(0, 6);
  });
  it('is continuous and monotonic', () => {
    let prev = -1;
    for (let i = 0; i <= 1000; i++) {
      const { pos } = legProfile(i / 1000);
      expect(pos).toBeGreaterThanOrEqual(prev - 1e-12);
      if (i > 0) expect(pos - prev).toBeLessThan(0.01);
      prev = pos;
    }
  });
  it('velocity integrates to position', () => {
    let acc = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) acc += legProfile((i + 0.5) / n).vel / n;
    expect(acc).toBeCloseTo(1, 4);
  });
});
