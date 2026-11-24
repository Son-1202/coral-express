import { makeCanvas, grain, rng, shade, type Paint } from '../paint/canvas';
import { SUNNY } from '../paint/palette';

/** Seamless periodic profile in [0,1] built from integer-frequency sines. */
export function profile(seed: number, w: number, terms: [number, number][]): (x: number) => number {
  const r = rng(seed);
  const parts = terms.map(([k, a]) => ({ k, a, ph: r() * Math.PI * 2 }));
  const total = parts.reduce((s, p) => s + p.a, 0);
  return (x: number) => {
    let v = 0;
    for (const p of parts) v += p.a * Math.sin((2 * Math.PI * p.k * x) / w + p.ph);
    return 0.5 + (0.5 * v) / total;
  };
}

function ridge(p: Paint, f: (x: number) => number, base: number, amp: number, color: string): void {
  const { ctx, w, h } = p;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, base - f(x) * amp);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

/** Far layer: hazy blue headlands with a lighthouse, tiling horizontally. */
export function paintFar(seed: number): HTMLCanvasElement {
  const p = makeCanvas(2048, 256);
  const { ctx, w, h } = p;
  const r = rng(seed);
  const back = profile(seed, w, [[2, 1], [5, 0.5], [11, 0.2]]);
  const front = profile(seed + 7, w, [[3, 1], [7, 0.4], [17, 0.15]]);
  ridge(p, back, h - 10, 150, shade(SUNNY.headland, 0.18));
  ridge(p, (x) => Math.pow(front(x), 2.2), h - 4, 140, SUNNY.headland);
  // soft sunlit tops
  ctx.globalAlpha = 0.35;
  ridge(p, (x) => Math.pow(front(x), 2.2) * 0.96 - 0.01, h - 4, 140, shade(SUNNY.headland, 0.25));
  ctx.globalAlpha = 1;
  ridge(p, (x) => Math.pow(front(x), 2.2) * 0.9 - 0.05, h + 2, 140, SUNNY.headlandDark);
  // lighthouse on the highest point
  let best = 0;
  let bx = 0;
  for (let x = 0; x < w; x += 4) {
    const v = Math.pow(front(x), 2.2);
    if (v > best && x > 60 && x < w - 60) {
      best = v;
      bx = x;
    }
  }
  const by = h - 4 - best * 140;
  ctx.fillStyle = '#f3efe6';
  ctx.fillRect(bx - 4, by - 30, 8, 32);
  ctx.fillStyle = '#e27a6b';
  ctx.fillRect(bx - 4, by - 22, 8, 5);
  ctx.fillRect(bx - 4, by - 10, 8, 5);
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(bx - 3, by - 36, 6, 6);
  ctx.fillStyle = '#c86656';
  ctx.beginPath();
  ctx.moveTo(bx - 5, by - 36);
  ctx.lineTo(bx, by - 42);
  ctx.lineTo(bx + 5, by - 36);
  ctx.fill();
  // tiny far houses specks
  for (let i = 0; i < 40; i++) {
    const x = r() * w;
    const y = h - 4 - Math.pow(front(x), 2.2) * 140 + 6 + r() * 20;
    if (y > h - 8) continue;
    ctx.fillStyle = r() < 0.5 ? '#eef0ea' : '#f2d6cc';
    ctx.fillRect(x, y, 4 + r() * 3, 3);
  }
  // haze at the base
  const g = ctx.createLinearGradient(0, h - 70, 0, h);
  g.addColorStop(0, 'rgba(240,236,225,0)');
  g.addColorStop(1, 'rgba(240,236,225,0.65)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  grain(p, seed + 3, 0.04);
  return p.canvas;
}
