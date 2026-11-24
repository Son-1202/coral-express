import { makeCanvas, rng, pick, type Paint } from '../paint/canvas';
import { SUNNY } from '../paint/palette';
import { PX } from './paintTrack';

type R = () => number;

function flowers(p: Paint, r: R, x: number, base: number, n: number, spread: number): void {
  const { ctx } = p;
  for (let i = 0; i < n; i++) {
    const fx = Math.floor(x + (r() - 0.5) * spread);
    const fh = 3 + Math.floor(r() * 8);
    ctx.fillStyle = SUNNY.grassDark;
    ctx.fillRect(fx, base - fh, 1, fh);
    ctx.fillStyle = pick(r, SUNNY.flowers);
    ctx.fillRect(fx - 1, base - fh - 2, 3, 3);
  }
}

function lemonTree(p: Paint, r: R, x: number, base: number, s: number): void {
  const { ctx } = p;
  ctx.fillStyle = SUNNY.trunk;
  ctx.fillRect(x - 2, base - s * 1.1, 5, s * 1.1);
  ctx.fillRect(x - 6, base - s * 0.9, 6, 3);
  const cy = base - s * 1.5;
  for (let i = 0; i < 9; i++) {
    const bx = x + (r() - 0.5) * s * 1.2;
    const by = cy + (r() - 0.5) * s * 0.8;
    const br = s * (0.3 + r() * 0.25);
    ctx.fillStyle = SUNNY.leafDark;
    ctx.beginPath();
    ctx.arc(bx + 2, by + 2, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i % 3 ? SUNNY.leaf : SUNNY.leafLight;
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = SUNNY.lemon;
  for (let i = 0; i < 12; i++) {
    const lx = x + (r() - 0.5) * s * 1.3;
    const ly = cy + (r() - 0.3) * s * 0.8;
    ctx.fillRect(Math.floor(lx), Math.floor(ly), 4, 3);
    ctx.fillStyle = '#fff3a0';
    ctx.fillRect(Math.floor(lx), Math.floor(ly), 2, 1);
    ctx.fillStyle = SUNNY.lemon;
  }
}

function picket(p: Paint, x0: number, x1: number, base: number): void {
  const { ctx } = p;
  ctx.fillStyle = '#d9d2c2';
  ctx.fillRect(x0, base - 11, x1 - x0, 2);
  ctx.fillRect(x0, base - 5, x1 - x0, 2);
  for (let x = x0; x < x1; x += 6) {
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(x, base - 15, 3, 15);
    ctx.fillRect(x + 1, base - 16, 1, 1);
    ctx.fillStyle = '#d9d2c2';
    ctx.fillRect(x + 2, base - 14, 1, 14);
  }
}

/** Near layer strip in front of the track: picket fences, flowers, a lemon tree or a pole. 16 × 3 units. */
export function paintNear(seed: number, variant: number): HTMLCanvasElement {
  const p = makeCanvas(16 * PX, 3 * PX);
  const { ctx, w, h } = p;
  const r = rng(seed + variant * 101);
  const base = h - 1;
  // low grass tufts all along
  for (let x = 0; x < w; x += 2) {
    ctx.fillStyle = r() < 0.5 ? SUNNY.grassDark : SUNNY.grass;
    ctx.fillRect(x, base - 1 - Math.floor(r() * 4), 2, 6);
  }
  picket(p, 20, 200, base);
  picket(p, 300, 470, base);
  flowers(p, r, 240, base, 26, 60);
  flowers(p, r, 100, base, 14, 120);
  flowers(p, r, 420, base, 14, 90);
  if (variant === 0) {
    lemonTree(p, r, 250, base, 16);
  } else {
    // little red post box + planter (kept low so it never hides the train)
    ctx.fillStyle = '#d65a4a';
    ctx.fillRect(244, base - 22, 12, 22);
    ctx.fillStyle = '#b8463a';
    ctx.fillRect(244, base - 22, 12, 3);
    ctx.fillStyle = '#2f2a2a';
    ctx.fillRect(247, base - 16, 6, 2);
    ctx.fillStyle = '#d9714d';
    ctx.fillRect(262, base - 8, 26, 8);
    flowers(p, r, 275, base - 8, 12, 22);
  }
  return p.canvas;
}

/** Back verge strip at the cliff edge behind the track: rope fence, agaves, hedges. 24 × 1.6 units. */
export function paintVergeBack(seed: number): HTMLCanvasElement {
  const p = makeCanvas(24 * PX, Math.round(1.6 * PX));
  const { ctx, w, h } = p;
  const r = rng(seed);
  const base = h - 1;
  // hedge clumps
  for (let x = 0; x < w; x += 6 + Math.floor(r() * 10)) {
    const s = 5 + r() * 9;
    ctx.fillStyle = SUNNY.leafDark;
    ctx.beginPath();
    ctx.arc(x, base - s * 0.5, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = r() < 0.5 ? SUNNY.leaf : SUNNY.grass;
    ctx.beginPath();
    ctx.arc(x - 1, base - s * 0.6, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = SUNNY.grass;
  ctx.fillRect(0, base - 4, w, 5);
  // wooden posts + rope
  for (let x = 8; x < w; x += 40) {
    ctx.fillStyle = SUNNY.woodDark;
    ctx.fillRect(x, base - 18, 3, 18);
    ctx.fillStyle = SUNNY.wood;
    ctx.fillRect(x, base - 18, 2, 17);
  }
  ctx.strokeStyle = '#c9b38a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 8; x < w; x += 40) {
    ctx.moveTo(x + 2, base - 15);
    ctx.quadraticCurveTo(x + 22, base - 10, x + 42, base - 15);
  }
  ctx.stroke();
  flowers(p, r, w * 0.3, base, 18, 120);
  flowers(p, r, w * 0.75, base, 18, 120);
  return p.canvas;
}

/** Foreground foliage right in front of the lens (heavily tilt-shift blurred). 14 × 2 units. */
export function paintNearFront(seed: number): HTMLCanvasElement {
  const p = makeCanvas(14 * 24, 2 * 24);
  const { ctx, w, h } = p;
  const r = rng(seed);
  const clumps = [w * 0.12, w * 0.62];
  for (const cx of clumps) {
    for (let i = 0; i < 14; i++) {
      const bx = cx + (r() - 0.5) * 60;
      const by = h - r() * 24;
      const br = 8 + r() * 12;
      ctx.fillStyle = i % 3 ? SUNNY.leafDark : SUNNY.leaf;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = pick(r, SUNNY.flowers);
      ctx.beginPath();
      ctx.arc(cx + (r() - 0.5) * 60, h - 6 - r() * 26, 3 + r() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return p.canvas;
}
