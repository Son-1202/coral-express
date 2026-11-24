import { makeCanvas, grain, rng, shade, pick, wrapDraw, type Paint } from '../paint/canvas';
import { SUNNY } from '../paint/palette';
import { profile } from './paintFar';

type R = () => number;

function house(ctx: CanvasRenderingContext2D, r: R, x: number, base: number, w: number, h: number, scale: number): void {
  const body = pick(r, SUNNY.houses);
  const roof = pick(r, SUNNY.roofs);
  const shut = pick(r, SUNNY.shutter);
  const top = base - h;
  // body + shadow side (sun from upper left)
  ctx.fillStyle = body;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = shade(body, -0.16);
  ctx.fillRect(x + w * 0.78, top, w * 0.22, h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, top, w * 0.08, h);
  // roof
  const kind = r();
  if (kind < 0.5) {
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 3 * scale, top + 1);
    ctx.lineTo(x + w / 2, top - h * 0.38);
    ctx.lineTo(x + w + 3 * scale, top + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(roof, -0.2);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, top - h * 0.38);
    ctx.lineTo(x + w + 3 * scale, top + 1);
    ctx.lineTo(x + w / 2, top + 1);
    ctx.closePath();
    ctx.fill();
  } else if (kind < 0.8) {
    ctx.fillStyle = shade(body, 0.35);
    ctx.fillRect(x - 2 * scale, top - 3 * scale, w + 4 * scale, 4 * scale);
  } else {
    // little dome / tower
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, top, w * 0.32, h * 0.3, 0, Math.PI, 0);
    ctx.fill();
  }
  // windows
  const cols = Math.max(1, Math.floor(w / (11 * scale)));
  const rows = Math.max(1, Math.floor(h / (15 * scale)));
  const ww = 4 * scale;
  const wh = 6 * scale;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (r() < 0.18) continue;
      const wx = x + ((cx + 0.5) * w) / cols - ww / 2;
      const wy = top + ((cy + 0.4) * h) / rows - wh / 2;
      ctx.fillStyle = SUNNY.window;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(wx, wy, ww, wh * 0.3);
      if (r() < 0.6) {
        ctx.fillStyle = shut;
        ctx.fillRect(wx - 2 * scale, wy, 1.6 * scale, wh);
        ctx.fillRect(wx + ww + 0.4 * scale, wy, 1.6 * scale, wh);
      }
    }
  }
  // striped awning on some
  if (r() < 0.35 && w > 22 * scale) {
    const aw = pick(r, SUNNY.awning);
    const ay = base - h * 0.32;
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#fffaf0' : aw;
      ctx.fillRect(x + 2 + (i * (w - 4)) / stripes, ay, (w - 4) / stripes + 0.5, 4 * scale);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + 2, ay + 4 * scale, w - 4, 2 * scale);
  }
}

function bush(ctx: CanvasRenderingContext2D, r: R, x: number, y: number, s: number, lemons: boolean): void {
  const blobs = 3 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const bx = x + (r() - 0.5) * s * 1.4;
    const by = y - r() * s * 0.6;
    const br = s * (0.45 + r() * 0.35);
    ctx.fillStyle = SUNNY.leafDark;
    ctx.beginPath();
    ctx.arc(bx + br * 0.15, by + br * 0.15, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i % 2 ? SUNNY.leaf : SUNNY.leafLight;
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lemons) {
    ctx.fillStyle = SUNNY.lemon;
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x + (r() - 0.5) * s * 1.6, y - r() * s, Math.max(2, s * 0.14), Math.max(2, s * 0.16));
    }
  } else if (r() < 0.5) {
    ctx.fillStyle = '#ef7fb4'; // bougainvillea
    for (let i = 0; i < 10; i++) ctx.fillRect(x + (r() - 0.5) * s * 1.6, y - r() * s, 2, 2);
  }
}

function cliffMass(p: Paint, f: (x: number) => number, base: number, amp: number): void {
  const { ctx, w, h } = p;
  const top = (x: number) => base - f(x) * amp;
  ctx.fillStyle = SUNNY.cliff;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, top(x));
  ctx.lineTo(w, h);
  ctx.fill();
  // strata shading, lit from the left
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let x = 0; x < w; x += 2) {
    const slope = top(x + 4) - top(x - 4);
    if (slope < 0) continue;
    ctx.fillStyle = `rgba(150,100,70,${Math.min(0.35, slope * 0.03)})`;
    ctx.fillRect(x, top(x), 2, h);
  }
  for (let y = 0; y < h; y += 9) {
    ctx.fillStyle = 'rgba(160,110,80,0.10)';
    ctx.fillRect(0, y, w, 2);
  }
  const g = ctx.createLinearGradient(0, h - 40, 0, h);
  g.addColorStop(0, 'rgba(120,90,70,0)');
  g.addColorStop(1, 'rgba(90,80,80,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Mid-far layer: sandstone cliffs crowned with a pastel village, bays between. */
export function paintMidFar(seed: number): HTMLCanvasElement {
  const p = makeCanvas(2048, 512);
  const { ctx, w, h } = p;
  const r = rng(seed);
  const raw = profile(seed, w, [[2, 1], [3, 0.6], [7, 0.25], [13, 0.12]]);
  const f = (x: number) => Math.max(0, (raw(x) - 0.3) / 0.7);
  const base = h - 6;
  const amp = 360;
  cliffMass(p, f, base, amp);
  const topY = (x: number) => base - f(x) * amp;
  // houses climbing the cliff in rows (back rows first)
  for (let row = 0; row < 5; row++) {
    for (let x = 0; x < w; ) {
      const hw = 28 + r() * 34;
      const cx = x + hw / 2;
      const t = topY(cx);
      const ground = t + row * 34 + 8;
      if (f(cx) > 0.25 + row * 0.08 && ground < base - 30 && r() < 0.85) {
        const hh = 28 + r() * 28;
        wrapDraw(w, x, hw + 10, (ox) => house(ctx, r, ox, ground, hw, hh, 1.4));
      }
      x += hw + 2 + r() * 10;
    }
  }
  // greenery and lemon trees between houses
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    if (f(x) < 0.15) continue;
    const y = topY(x) + r() * 120 + 10;
    if (y > base - 20) continue;
    bush(ctx, r, x, y, 8 + r() * 8, r() < 0.4);
  }
  grain(p, seed + 5, 0.06);
  return p.canvas;
}

/** Mid-near layer: rocky islets with a few fishermen's houses and moored boats. */
export function paintMidNear(seed: number): HTMLCanvasElement {
  const p = makeCanvas(2048, 384);
  const { ctx, w, h } = p;
  const r = rng(seed);
  const raw = profile(seed, w, [[3, 1], [5, 0.5], [11, 0.2]]);
  const f = (x: number) => Math.max(0, (raw(x) - 0.55) / 0.45);
  const base = h - 4;
  const amp = 230;
  // rocks: darker, warmer stone
  ctx.fillStyle = SUNNY.cliffShade;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, base - f(x) * amp);
  ctx.lineTo(w, h);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,235,200,0.18)' : 'rgba(110,70,50,0.18)';
    const x = r() * w;
    ctx.beginPath();
    ctx.ellipse(x, base - r() * f(x) * amp, 6 + r() * 14, 3 + r() * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, h - 30, 0, h);
  g.addColorStop(0, 'rgba(60,90,100,0)');
  g.addColorStop(1, 'rgba(60,90,100,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // grass caps
  for (let x = 0; x < w; x += 3) {
    if (f(x) < 0.12) continue;
    const t = base - f(x) * amp;
    ctx.fillStyle = x % 6 ? SUNNY.grass : SUNNY.grassLight;
    ctx.fillRect(x, t - 2, 3, 6 + ((x * 7) % 5));
  }
  // houses on top of the larger islets
  for (let x = 40; x < w - 80; x += 90 + r() * 120) {
    if (f(x) < 0.5) continue;
    const t = base - f(x + 30) * amp;
    const hw = 40 + r() * 30;
    house(ctx, r, x, t + 6, hw, 34 + r() * 22, 1.8);
    bush(ctx, r, x - 6, t + 6, 12, r() < 0.6);
  }
  // little sailboats in the gaps
  for (let x = 30; x < w - 30; x += 70 + r() * 140) {
    if (f(x) > 0.02 || f(x + 40) > 0.02) continue;
    const by = base - 2;
    ctx.fillStyle = pick(r, ['#e45b4f', '#2c7fa8', '#f2a33c']);
    ctx.beginPath();
    ctx.moveTo(x - 18, by - 10);
    ctx.lineTo(x + 18, by - 10);
    ctx.lineTo(x + 12, by);
    ctx.lineTo(x - 12, by);
    ctx.fill();
    ctx.fillStyle = '#5b4a3a';
    ctx.fillRect(x - 1, by - 52, 2, 42);
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.moveTo(x + 2, by - 50);
    ctx.lineTo(x + 22, by - 14);
    ctx.lineTo(x + 2, by - 14);
    ctx.fill();
    ctx.fillStyle = '#f3e3c8';
    ctx.beginPath();
    ctx.moveTo(x - 2, by - 44);
    ctx.lineTo(x - 15, by - 14);
    ctx.lineTo(x - 2, by - 14);
    ctx.fill();
  }
  grain(p, seed + 9, 0.06);
  return p.canvas;
}
