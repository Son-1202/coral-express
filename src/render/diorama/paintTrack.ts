import { makeCanvas, grain, rng, pick, shade } from '../paint/canvas';
import { SUNNY } from '../paint/palette';

/** Pixel density for the crisp "sprite" layers (track, near, train). */
export const PX = 32;

/** Track bed seen from above: ballast + sleepers + two rails. 24 units wide × 2.3 deep. */
export function paintTrackBed(seed: number): HTMLCanvasElement {
  const p = makeCanvas(24 * PX, 74);
  const { ctx, w, h } = p;
  const r = rng(seed);
  ctx.fillStyle = SUNNY.ballast;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = pick(r, ['#c9b9a0', '#a8977f', '#d9cbb3', '#9b8b74']);
    ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2, 1);
  }
  // sleepers every 0.5 units
  for (let x = 0; x < w; x += PX / 2) {
    ctx.fillStyle = SUNNY.woodDark;
    ctx.fillRect(x + 2, 14, 7, 46);
    ctx.fillStyle = SUNNY.wood;
    ctx.fillRect(x + 2, 14, 6, 44);
  }
  // rails (back and front)
  for (const ry of [22, 50]) {
    ctx.fillStyle = SUNNY.rail;
    ctx.fillRect(0, ry, w, 4);
    ctx.fillStyle = SUNNY.railTop;
    ctx.fillRect(0, ry, w, 1);
  }
  // grass edges
  for (let x = 0; x < w; x += 2) {
    ctx.fillStyle = r() < 0.5 ? SUNNY.grass : SUNNY.grassDark;
    ctx.fillRect(x, 0, 2, 3 + Math.floor(r() * 4));
    ctx.fillRect(x, h - 3 - Math.floor(r() * 3), 2, 6);
  }
  return p.canvas;
}

/** Front-face rail (seen side-on) — a thin steel bar with sleeper ends below. 24 × 0.25 units. */
export function paintRailSide(): HTMLCanvasElement {
  const p = makeCanvas(24 * PX, 8);
  const { ctx, w } = p;
  for (let x = 0; x < w; x += PX / 2) {
    ctx.fillStyle = SUNNY.woodDark;
    ctx.fillRect(x + 1, 5, 9, 3);
  }
  ctx.fillStyle = '#5d6a72';
  ctx.fillRect(0, 1, w, 4);
  ctx.fillStyle = SUNNY.railTop;
  ctx.fillRect(0, 0, w, 2);
  for (let x = 0; x < w; x += PX * 2) {
    ctx.fillStyle = '#4a555c';
    ctx.fillRect(x, 1, 2, 4); // rail joint
  }
  return p.canvas;
}

/** Stone embankment wall below the track, with grass lip. 24 × 1.0 units. */
export function paintWall(seed: number): HTMLCanvasElement {
  const p = makeCanvas(24 * PX, PX);
  const { ctx, w, h } = p;
  const r = rng(seed);
  ctx.fillStyle = SUNNY.stoneDark;
  ctx.fillRect(0, 0, w, h);
  const rowH = 7;
  for (let y = 4, row = 0; y < h; y += rowH, row++) {
    let x = row % 2 ? -6 : 0;
    while (x < w) {
      const sw = 10 + Math.floor(r() * 10);
      const c = pick(r, [SUNNY.stone, shade(SUNNY.stone, 0.12), shade(SUNNY.stone, -0.06), '#e3d1b0']);
      ctx.fillStyle = c;
      ctx.fillRect(x + 1, y + 1, sw - 1, rowH - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 1, y + 1, sw - 1, 1);
      x += sw;
    }
  }
  // grass lip and moss
  for (let x = 0; x < w; x++) {
    const gh = 3 + Math.floor(r() * 3);
    ctx.fillStyle = x % 3 ? SUNNY.grass : SUNNY.grassLight;
    ctx.fillRect(x, 0, 1, gh);
    if (r() < 0.05) {
      ctx.fillStyle = SUNNY.grassDark;
      ctx.fillRect(x, gh, 2, 2 + Math.floor(r() * 5));
    }
  }
  // shadow at the bottom
  const g = ctx.createLinearGradient(0, h - 10, 0, h);
  g.addColorStop(0, 'rgba(60,50,60,0)');
  g.addColorStop(1, 'rgba(60,50,60,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return p.canvas;
}

/** Grass ground seen from above (verge behind track / garden in front). */
export function paintGrass(seed: number, wUnits: number, dUnits: number, path: boolean): HTMLCanvasElement {
  const p = makeCanvas(wUnits * 16, dUnits * 16);
  const { ctx, w, h } = p;
  const r = rng(seed);
  ctx.fillStyle = SUNNY.grass;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h * 0.08; i++) {
    ctx.fillStyle = pick(r, [SUNNY.grassDark, SUNNY.grassLight, '#9bcb6c', '#7bb558']);
    ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2, 1);
  }
  if (path) {
    const py = Math.floor(h * 0.28);
    ctx.fillStyle = '#e8d7b0';
    ctx.fillRect(0, py, w, 10);
    for (let i = 0; i < w / 3; i++) {
      ctx.fillStyle = r() < 0.5 ? '#d8c59c' : '#f2e5c4';
      ctx.fillRect(Math.floor(r() * w), py + Math.floor(r() * 10), 2, 1);
    }
  }
  grain(p, seed, 0.05);
  return p.canvas;
}
