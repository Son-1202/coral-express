import { makeCanvas, grain, rng, pick, shade } from '../paint/canvas';
import type { ForeStyle } from './foreStyle';
import { PX } from './paintTrack';

/** Embankment wall below the track in a Line's stone (boulder = mossy granite, lava = black porous rock). 24 × 1 units. */
export function paintForeWall(st: ForeStyle, seed: number): HTMLCanvasElement {
  const p = makeCanvas(24 * PX, PX);
  const { ctx, w, h } = p;
  const r = rng(seed);
  ctx.fillStyle = st.wallBase;
  ctx.fillRect(0, 0, w, h);
  if (st.wall === 'boulder') {
    // rounded stacked stones with moss caps
    for (let row = 0; row < 3; row++) {
      let x = row % 2 ? -8 : -2;
      const y = 4 + row * 9;
      while (x < w) {
        const sw = 12 + Math.floor(r() * 12);
        const c = pick(r, st.stones);
        ctx.fillStyle = shade(c, -0.25);
        ctx.beginPath();
        ctx.ellipse(x + sw / 2, y + 5, sw / 2, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(x + sw / 2, y + 4, sw / 2 - 1, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(c, 0.2);
        ctx.fillRect(x + 3, y + 1, Math.max(2, sw / 3), 1);
        if (r() < 0.45) {
          ctx.fillStyle = st.moss;
          ctx.fillRect(x + 2, y, Math.floor(sw * (0.3 + r() * 0.4)), 2);
          ctx.fillStyle = shade(st.moss, 0.25);
          ctx.fillRect(x + 3, y, Math.floor(sw * 0.2), 1);
        }
        x += sw - 1;
      }
    }
  } else if (st.wall === 'lava') {
    // irregular black lava blocks with porous pits and a faint warm rim
    let x = 0;
    while (x < w) {
      const sw = 10 + Math.floor(r() * 16);
      const top = 3 + Math.floor(r() * 4);
      const c = pick(r, st.stones);
      ctx.fillStyle = c;
      ctx.fillRect(x + 1, top, sw - 1, h - top);
      ctx.fillStyle = shade(c, 0.18);
      ctx.fillRect(x + 1, top, sw - 1, 1);
      ctx.fillStyle = shade(c, -0.4);
      ctx.fillRect(x, top, 1, h - top);
      for (let i = 0; i < sw / 2; i++) {
        ctx.fillStyle = r() < 0.8 ? '#141213' : '#5a4a44';
        ctx.fillRect(x + 1 + Math.floor(r() * (sw - 2)), top + 2 + Math.floor(r() * (h - top - 3)), 1 + Math.floor(r() * 2), 1);
      }
      x += sw;
    }
  } else {
    for (let y = 4, row = 0; y < h; y += 7, row++) {
      let x = row % 2 ? -6 : 0;
      while (x < w) {
        const sw = 10 + Math.floor(r() * 10);
        ctx.fillStyle = pick(r, st.stones);
        ctx.fillRect(x + 1, y + 1, sw - 1, 6);
        x += sw;
      }
    }
  }
  // grass lip with hanging tufts
  for (let x = 0; x < w; x++) {
    const gh = 3 + Math.floor(r() * 3);
    ctx.fillStyle = x % 3 ? st.grass : st.grassLight;
    ctx.fillRect(x, 0, 1, gh);
    if (r() < 0.06) {
      ctx.fillStyle = st.grassDark;
      ctx.fillRect(x, gh, 2, 2 + Math.floor(r() * 6));
    }
  }
  const g = ctx.createLinearGradient(0, h - 10, 0, h);
  g.addColorStop(0, 'rgba(30,25,35,0)');
  g.addColorStop(1, 'rgba(30,25,35,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return p.canvas;
}

/** Ground seen from above in a Line's grass, with an optional garden path. */
export function paintForeGrass(st: ForeStyle, seed: number, wUnits: number, dUnits: number, path: boolean): HTMLCanvasElement {
  const p = makeCanvas(wUnits * 16, dUnits * 16);
  const { ctx, w, h } = p;
  const r = rng(seed);
  ctx.fillStyle = st.grass;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h * 0.08; i++) {
    ctx.fillStyle = pick(r, st.specks);
    ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2, 1);
  }
  if (path) {
    const py = Math.floor(h * 0.28);
    ctx.fillStyle = st.path;
    ctx.fillRect(0, py, w, 10);
    for (let i = 0; i < w / 2; i++) {
      ctx.fillStyle = pick(r, st.pathSpecks);
      ctx.fillRect(Math.floor(r() * w), py + Math.floor(r() * 10), 2, 1);
    }
  }
  grain(p, seed, 0.05);
  return p.canvas;
}
