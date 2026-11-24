import { describe, expect, it } from 'vitest';
import { ALL_PROFILES, createMover, Hopper, isSwarm, SWARM_MAX, SWARM_MIN, type MotionBounds, type MotionEnv } from '../../../src/render/tank/motion';
import { Slosh } from '../../../src/render/tank/slosh';

const B: MotionBounds = { minX: 0.5, maxX: 15.5, minY: 1.6, maxY: 7.6, floorY: 1.6 };
const env = (time: number, extra: Partial<MotionEnv> = {}): MotionEnv => ({ time, bounds: B, tilt: 0, food: null, ...extra });

function run(profile: (typeof ALL_PROFILES)[number], seconds: number, seed = 1, extra: Partial<MotionEnv> = {}) {
  const m = createMover(profile, seed, B, { size: 0.4 });
  const xs: number[] = [];
  const ys: number[] = [];
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    m.step(dt, env(t, extra));
    xs.push(m.pose.x);
    ys.push(m.pose.y);
  }
  return { m, xs, ys };
}

describe('tank motion profiles', () => {
  it.each(ALL_PROFILES)('%s stays inside the bounds and produces finite poses', (p) => {
    const { m, xs, ys } = run(p, 30);
    for (let i = 0; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThanOrEqual(B.minX - 1e-6);
      expect(xs[i]).toBeLessThanOrEqual(B.maxX + 1e-6);
      expect(ys[i]).toBeGreaterThanOrEqual(B.minY - 1e-6);
      expect(ys[i]).toBeLessThanOrEqual(B.maxY + 1e-6);
    }
    for (const v of Object.values(m.pose)) expect(Number.isFinite(v)).toBe(true);
  });

  it.each(ALL_PROFILES.filter((p) => p !== 'sessile'))('%s actually moves', (p) => {
    const { xs, ys } = run(p, 20);
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    expect(dx + dy).toBeGreaterThan(0.5);
  });

  it('sessile stays anchored but sways', () => {
    const m = createMover('sessile', 3, B, { size: 0.4, anchorX: 5 });
    const rots: number[] = [];
    for (let t = 0; t < 10; t += 1 / 60) {
      m.step(1 / 60, env(t));
      rots.push(m.pose.rot);
      expect(m.pose.x).toBe(5);
      expect(m.pose.y).toBe(B.floorY);
    }
    expect(Math.max(...rots) - Math.min(...rots)).toBeGreaterThan(0.03);
  });

  it('crawler is floor-locked (only short hops)', () => {
    const { ys } = run('crawler', 20);
    expect(Math.max(...ys) - B.floorY).toBeLessThan(0.4 * 0.4 + 1e-6);
  });

  it('hopper sometimes sticks to the glass', () => {
    let glass = false;
    for (let seed = 1; seed < 6 && !glass; seed++) {
      const m = createMover('hopper', seed, B, { size: 0.4 }) as Hopper;
      for (let t = 0; t < 40; t += 1 / 60) {
        m.step(1 / 60, env(t));
        if (m.onGlass) glass = m.pose.y > B.floorY + 0.5 && m.pose.depthBias < -0.1;
        if (glass) break;
      }
    }
    expect(glass).toBe(true);
  });

  it('swarm has 40–80 agents that stay together', () => {
    const m = createMover('swarm', 9, B, { size: 0.4 });
    if (!isSwarm(m)) throw new Error('not a swarm');
    expect(m.count).toBeGreaterThanOrEqual(SWARM_MIN);
    expect(m.count).toBeLessThanOrEqual(SWARM_MAX);
    for (let t = 0; t < 20; t += 1 / 60) m.step(1 / 60, env(t));
    expect(m.spread()).toBeLessThan(5);
  });

  it('darters head for food', () => {
    const food = { x: 14, y: 3 };
    const { m } = run('darter', 12, 4, { food });
    expect(Math.hypot(m.pose.x - food.x, m.pose.y - food.y)).toBeLessThan(1);
  });

  it('turning mirrors with a squash', () => {
    const m = createMover('darter', 2, B, { size: 0.4 });
    let squashed = false;
    let lastFacing = m.pose.facing;
    for (let t = 0; t < 30; t += 1 / 60) {
      m.step(1 / 60, env(t));
      if (m.pose.facing !== lastFacing) {
        lastFacing = m.pose.facing;
        squashed ||= m.pose.sx < 0.8;
      }
    }
    expect(squashed).toBe(true);
  });

  it('is deterministic per seed', () => {
    const a = run('glider', 5, 7);
    const b = run('glider', 5, 7);
    expect(a.xs).toEqual(b.xs);
  });
});

describe('slosh', () => {
  it('kicks then settles within ~1.5 s', () => {
    const s = new Slosh();
    s.impulse(1);
    let peak = 0;
    for (let t = 0; t < 0.5; t += 1 / 60) peak = Math.max(peak, Math.abs(s.update(1 / 60)));
    expect(peak).toBeGreaterThan(0.05);
    for (let t = 0; t < 1.0; t += 1 / 60) s.update(1 / 60);
    expect(Math.abs(s.tilt)).toBeLessThan(peak * 0.1);
  });
});
