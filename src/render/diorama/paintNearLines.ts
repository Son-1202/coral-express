import { makeCanvas, rng, pick, shade, type Paint } from '../paint/canvas';
import type { ForeStyle } from './foreStyle';
import { PX } from './paintTrack';

/**
 * Near strips in front of the track for Fog Fjords (L2) and Volcano Isles (L3),
 * 16 × 3 units like Line 1's `paintNear`. Everything stays under ~1.2 units so
 * it never hides the train.
 */
type R = () => number;

function tufts(p: Paint, r: R, st: ForeStyle, base: number): void {
  for (let x = 0; x < p.w; x += 2) {
    p.ctx.fillStyle = r() < 0.5 ? st.grassDark : st.grass;
    p.ctx.fillRect(x, base - 1 - Math.floor(r() * 4), 2, 6);
  }
}

function rock(p: Paint, r: R, st: ForeStyle, x: number, base: number, s: number, mossy: boolean): void {
  const { ctx } = p;
  const c = pick(r, st.stones);
  ctx.fillStyle = shade(c, -0.3);
  ctx.beginPath();
  ctx.ellipse(x, base - s * 0.45, s, s * 0.55, 0, Math.PI, 0);
  ctx.lineTo(x + s, base);
  ctx.lineTo(x - s, base);
  ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(x - 1, base - s * 0.5, s - 1.5, s * 0.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = shade(c, 0.2);
  ctx.fillRect(Math.floor(x - s * 0.5), Math.floor(base - s * 0.9), Math.floor(s * 0.5), 1);
  if (mossy) {
    ctx.fillStyle = st.moss;
    ctx.beginPath();
    ctx.ellipse(x - 1, base - s * 0.85, s * 0.6, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (let i = 0; i < s; i++) {
      ctx.fillStyle = '#141213';
      ctx.fillRect(Math.floor(x + (r() - 0.5) * s * 1.4), Math.floor(base - r() * s * 0.8), 1, 1);
    }
  }
}

function fern(p: Paint, r: R, st: ForeStyle, x: number, base: number, s: number): void {
  const { ctx } = p;
  for (let f = 0; f < 5; f++) {
    const ang = -Math.PI / 2 + (f - 2) * 0.42 + (r() - 0.5) * 0.2;
    const len = s * (0.7 + r() * 0.4);
    for (let i = 0; i < len; i++) {
      const bend = (i / len) * (i / len) * (f - 2) * 0.35;
      const px = Math.floor(x + Math.cos(ang + bend) * i);
      const py = Math.floor(base + Math.sin(ang + bend) * i);
      ctx.fillStyle = st.leafDark;
      ctx.fillRect(px, py, 1, 1);
      if (i % 2 === 0 && i < len - 1) {
        const w = Math.max(1, Math.floor((1 - i / len) * 4));
        ctx.fillStyle = i % 4 ? st.leaf : st.leafLight;
        ctx.fillRect(px - w, py, w, 1);
        ctx.fillRect(px + 1, py, w, 1);
      }
    }
  }
  // fiddlehead curl
  ctx.fillStyle = st.leafLight;
  ctx.fillRect(x + 3, base - s - 2, 3, 1);
  ctx.fillRect(x + 5, base - s - 1, 1, 3);
  ctx.fillRect(x + 3, base - s + 1, 2, 1);
}

function lupin(p: Paint, r: R, st: ForeStyle, x: number, base: number, hgt: number): void {
  const { ctx } = p;
  ctx.fillStyle = st.leafDark;
  ctx.fillRect(x, base - hgt * 0.5, 1, hgt * 0.5);
  ctx.fillStyle = st.leaf;
  ctx.fillRect(x - 3, base - 3, 3, 1);
  ctx.fillRect(x + 1, base - 4, 3, 1);
  const col = pick(r, st.flowers.slice(0, 3));
  for (let y = 0; y < hgt * 0.6; y++) {
    const w = Math.max(1, Math.round(2.5 - (y / (hgt * 0.6)) * 2));
    ctx.fillStyle = y % 2 ? col : shade(col, 0.25);
    ctx.fillRect(x - w + 1, base - hgt * 0.45 - y, w * 2 - 1, 1);
  }
}

function hibiscusBush(p: Paint, r: R, st: ForeStyle, x: number, base: number, s: number): void {
  const { ctx } = p;
  for (let i = 0; i < 8; i++) {
    const bx = x + (r() - 0.5) * s * 1.6;
    const by = base - s * 0.45 + (r() - 0.5) * s * 0.5;
    ctx.fillStyle = st.leafDark;
    ctx.beginPath();
    ctx.arc(bx + 1, by + 1, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i % 3 ? st.leaf : st.leafLight;
    ctx.beginPath();
    ctx.arc(bx, by, s * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const fx = Math.floor(x + (r() - 0.5) * s * 1.5);
    const fy = Math.floor(base - s * 0.5 + (r() - 0.6) * s * 0.7);
    const c = pick(r, st.flowers.slice(0, 2));
    ctx.fillStyle = shade(c, -0.2);
    ctx.fillRect(fx - 3, fy - 1, 7, 3);
    ctx.fillRect(fx - 1, fy - 3, 3, 7);
    ctx.fillStyle = c;
    ctx.fillRect(fx - 2, fy - 2, 5, 5);
    ctx.fillStyle = '#ffd447';
    ctx.fillRect(fx, fy, 1, 1);
  }
}

function bambooFence(p: Paint, r: R, st: ForeStyle, x0: number, x1: number, base: number): void {
  const { ctx } = p;
  for (let x = x0; x < x1; x += 7) {
    const hgt = 22 + Math.floor(r() * 6);
    ctx.fillStyle = st.woodDark;
    ctx.fillRect(x, base - hgt, 5, hgt);
    ctx.fillStyle = st.wood;
    ctx.fillRect(x + 1, base - hgt, 3, hgt);
    ctx.fillStyle = shade(st.wood, 0.3);
    ctx.fillRect(x + 1, base - hgt, 1, hgt);
    for (let j = base - hgt + 7; j < base; j += 8) {
      ctx.fillStyle = st.woodDark;
      ctx.fillRect(x, j, 5, 1);
    }
    ctx.fillStyle = shade(st.woodDark, -0.2);
    ctx.fillRect(x + 1, base - hgt, 3, 1);
  }
  // rope lashing
  ctx.fillStyle = '#c9b38a';
  for (const y of [base - 16, base - 7]) {
    ctx.fillRect(x0, y, x1 - x0, 1);
    for (let x = x0 + 2; x < x1; x += 7) ctx.fillRect(x, y - 1, 2, 3);
  }
}

function railFence(p: Paint, st: ForeStyle, x0: number, x1: number, base: number): void {
  const { ctx } = p;
  for (const y of [base - 19, base - 10]) {
    ctx.fillStyle = st.woodDark;
    ctx.fillRect(x0, y, x1 - x0, 4);
    ctx.fillStyle = st.wood;
    ctx.fillRect(x0, y, x1 - x0, 2);
  }
  for (let x = x0; x <= x1 - 4; x += 46) {
    ctx.fillStyle = st.woodDark;
    ctx.fillRect(x, base - 25, 5, 25);
    ctx.fillStyle = st.wood;
    ctx.fillRect(x + 1, base - 25, 3, 24);
    ctx.fillStyle = shade(st.wood, 0.25);
    ctx.fillRect(x + 1, base - 25, 3, 1);
  }
}

/** Fog Fjords: weathered post-and-rail fence, mossy granite, ferns and lupins. */
export function paintNearFjord(st: ForeStyle, seed: number, variant: number): HTMLCanvasElement {
  const p = makeCanvas(16 * PX, 3 * PX);
  const r = rng(seed + variant * 101);
  const base = p.h - 1;
  tufts(p, r, st, base);
  railFence(p, st, 10, 230, base);
  railFence(p, st, 300, 500, base);
  for (const x of [60, 180, 330, 450]) fern(p, r, st, x + Math.floor(r() * 20), base, 13 + r() * 5);
  for (let i = 0; i < 7; i++) lupin(p, r, st, 240 + Math.floor((r() - 0.5) * 60), base, 22 + r() * 10);
  for (let i = 0; i < 4; i++) lupin(p, r, st, 120 + Math.floor(r() * 300), base, 18 + r() * 8);
  rock(p, r, st, variant ? 395 : 110, base, 11, true);
  rock(p, r, st, variant ? 140 : 380, base, 8, true);
  rock(p, r, st, 280, base, 6, true);
  return p.canvas;
}

/** Volcano Isles: lashed bamboo fence, black lava rocks, hibiscus and ferns. */
export function paintNearVolcano(st: ForeStyle, seed: number, variant: number): HTMLCanvasElement {
  const p = makeCanvas(16 * PX, 3 * PX);
  const r = rng(seed + variant * 101);
  const base = p.h - 1;
  tufts(p, r, st, base);
  bambooFence(p, r, st, 16, 196, base);
  bambooFence(p, r, st, 310, 470, base);
  hibiscusBush(p, r, st, variant ? 250 : 260, base, 20);
  hibiscusBush(p, r, st, variant ? 90 : 420, base, 14);
  for (const x of [40, 210, 350, 490]) fern(p, r, st, x + Math.floor(r() * 16), base, 12 + r() * 6);
  rock(p, r, st, variant ? 150 : 330, base, 10, false);
  rock(p, r, st, 455, base, 7, false);
  rock(p, r, st, 20, base, 6, false);
  return p.canvas;
}
