import { makeCanvas, grain, rng, wrapDraw, type Paint } from '../paint/canvas';
import { SUNNY } from '../paint/palette';

/** Vertical sky gradient with a soft sun glow (does not tile; follows the camera). */
export function paintSky(): HTMLCanvasElement {
  const p = makeCanvas(512, 512);
  const { ctx, w, h } = p;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SUNNY.skyTop);
  g.addColorStop(0.55, SUNNY.skyMid);
  g.addColorStop(0.86, SUNNY.skyHorizon);
  g.addColorStop(1, '#ffe6c4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const sx = w * 0.28;
  const sy = h * 0.5;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, w * 0.45);
  glow.addColorStop(0, 'rgba(255,250,225,0.95)');
  glow.addColorStop(0.08, 'rgba(255,245,210,0.7)');
  glow.addColorStop(0.35, 'rgba(255,236,200,0.22)');
  glow.addColorStop(1, 'rgba(255,236,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SUNNY.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 15, 0, Math.PI * 2);
  ctx.fill();
  return p.canvas;
}

function cloud(p: Paint, r: () => number, x: number, y: number, s: number): void {
  const { ctx } = p;
  const puffs = 5 + Math.floor(r() * 5);
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < puffs; i++) {
    const px = x + (i - puffs / 2) * s * 0.55 + (r() - 0.5) * s * 0.3;
    const pr = s * (0.35 + r() * 0.4) * (1 - Math.abs(i - puffs / 2) / puffs);
    blobs.push([px, y - pr * 0.3, pr]);
  }
  const span = s * puffs * 0.4;
  wrapDraw(p.w, x, span, (ox) => {
    const dx = ox - x;
    ctx.fillStyle = SUNNY.cloudShade;
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.arc(bx + dx + br * 0.08, by + br * 0.18, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = SUNNY.cloud;
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.arc(bx + dx, by, br * 0.92, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Tiling strip of fluffy picture-book clouds on transparent background. */
export function paintClouds(seed: number): HTMLCanvasElement {
  const p = makeCanvas(1024, 256);
  const r = rng(seed);
  for (let i = 0; i < 7; i++) {
    const x = (i / 7) * p.w + r() * 60;
    const y = 60 + r() * 140;
    cloud(p, r, x, y, 26 + r() * 30);
  }
  grain(p, seed + 1, 0.05);
  return p.canvas;
}
