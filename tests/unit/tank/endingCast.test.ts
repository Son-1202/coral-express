import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { endingCars, ownedSpecies } from '../../../src/render/ending/owned';
import { DEPTH_LAYERS, depthOf, floorAnchors, FLOOR_PROFILES, overlap, separate, spreadSlots, type Body } from '../../../src/render/ending/spread';
import { createMover, isSwarm } from '../../../src/render/tank/motion';

const data = loadGameData();

describe('ending beach carriages (QA bug 5)', () => {
  it("maps the player's carriages in order with their own fish", () => {
    const sp = data.species.filter((s) => s.motion !== 'swarm');
    const a = sp[0]!.id;
    const b = sp[1]!.id;
    const fish = { f1: { species: a, shiny: false }, f2: { species: b, shiny: true }, f3: { species: 'nope', shiny: false } };
    const cars = endingCars(
      [
        { habitat: 'reef', fish: ['f1', 'f3'] },
        { habitat: 'kelp', fish: ['f2', 'missing'] },
      ],
      fish,
      data.species,
    );
    expect(cars.map((c) => c.habitat)).toEqual(['reef', 'kelp']);
    expect(cars[0]!.fish.map((f) => f.species)).toEqual([a]);
    expect(cars[1]!.fish[0]).toMatchObject({ species: b, shiny: true });
  });
  it('caps at 8 carriages; one carriage stays one carriage', () => {
    const many = Array.from({ length: 11 }, () => ({ habitat: 'reef', fish: [] as string[] }));
    expect(endingCars(many, {}, data.species)).toHaveLength(8);
    expect(endingCars([{ habitat: 'polar', fish: [] }], {}, data.species)).toHaveLength(1);
  });
});

describe('ending panorama spread (QA bug 6)', () => {
  it('spreads slots inside the box and mixes depth layers', () => {
    const box = { minX: 0, maxX: 1200, minY: 100, maxY: 500 };
    const s = spreadSlots(12, box, 3);
    expect(s).toHaveLength(12);
    for (const p of s) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1200);
      expect(p.y).toBeGreaterThanOrEqual(100);
      expect(p.y).toBeLessThanOrEqual(500);
    }
    expect(new Set([0, 1, 2, 3, 4, 5].map(depthOf)).size).toBe(DEPTH_LAYERS.length);
    expect(floorAnchors(3, 0, 300)).toEqual([50, 150, 250]);
  });
  it('separate() pushes overlapping bodies apart; floor bodies stay on the floor', () => {
    const bodies: Body[] = [
      { x: 100, y: 100, rx: 40, ry: 20 },
      { x: 110, y: 105, rx: 40, ry: 20 },
      { x: 300, y: 10, rx: 30, ry: 15, floor: true },
      { x: 305, y: 10, rx: 30, ry: 15, floor: true },
    ];
    const before = overlap(bodies);
    for (let i = 0; i < 20; i++) separate(bodies, 0.6);
    expect(overlap(bodies)).toBeLessThan(before * 0.05);
    expect(bodies[2]!.y).toBe(10);
    expect(bodies[3]!.y).toBe(10);
  });
  it('the whole cast stays (nearly) overlap-free while swimming', () => {
    const w = 1280;
    const h = 720;
    const b = { minX: w * 0.04, maxX: w * 0.96, minY: h * 0.1, maxY: h * 0.7, floorY: h * 0.1 };
    const cast = ownedSpecies(data.species.map((s) => ({ species: s.id, shiny: false })), data.species).filter((f) => f.motion !== 'swarm').slice(0, 18);
    const size = Math.max(h * 0.022, Math.min(h * 0.055, (h * 0.5) / Math.sqrt(cast.length * 4)));
    const floorN = cast.filter((f) => FLOOR_PROFILES.has(f.motion)).length;
    const anchors = floorAnchors(floorN, b.minX + size * 2, b.maxX - size * 2);
    let fi = 0;
    const actors = cast.map((f, i) => {
      const floor = FLOOR_PROFILES.has(f.motion);
      const sz = size * DEPTH_LAYERS[floor ? 2 : depthOf(i)].scale;
      return { floor, size: sz, mover: createMover(f.motion, 11 + i, b, { size: sz, anchorX: floor ? anchors[fi++] : undefined }) };
    });
    const swim = actors.filter((a) => !a.floor && !isSwarm(a.mover));
    spreadSlots(swim.length, { minX: b.minX + size * 2, maxX: b.maxX - size * 2, minY: b.minY + size * 3, maxY: b.maxY }, 7).forEach((p, i) => swim[i]!.mover.place(p.x, p.y));
    const env = { time: 0, bounds: b, tilt: 0, food: null };
    let worst = 0;
    for (let f = 0; f < 300; f++) {
      env.time = f / 60;
      for (const a of actors) a.mover.step(1 / 60, env);
      const bodies = actors.map((a) => ({ a, x: a.mover.pose.x, y: a.mover.pose.y, rx: a.size * 1.6 * 0.92, ry: a.size * 0.92, floor: a.floor }));
      separate(bodies, 0.6, b);
      separate(bodies, 0.6, b);
      for (const o of bodies) o.a.mover.place(o.x, o.floor ? o.a.mover.pose.y : o.y);
      if (f > 30) worst = Math.max(worst, overlap(bodies));
    }
    expect(worst).toBeLessThan(1.5);
  });
});
