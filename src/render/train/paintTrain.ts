import { makeCanvas, rng, shade } from '../paint/canvas';
import { LIVERY } from '../paint/palette';
import { PX } from '../diorama/paintTrack';

export const LOCO = { w: 3.1, h: 2.0 } as const;
export const CAR = { w: 2.7, h: 1.7 } as const;
/** Glass window of a carriage, in carriage-local units from its bottom-left. */
export const TANK_WINDOW = { x: 0.2, y: 0.42, w: 2.3, h: 0.98 } as const;

type Ctx = CanvasRenderingContext2D;

function rivets(ctx: Ctx, x0: number, x1: number, y: number, step: number): void {
  for (let x = x0; x <= x1; x += step) {
    ctx.fillStyle = LIVERY.brassLight;
    ctx.fillRect(Math.round(x), y, 1, 1);
  }
}

/** Seafoam + cream tank locomotive, facing right. Wheels are separate meshes. */
export function paintLocomotive(): HTMLCanvasElement {
  const W = Math.round(LOCO.w * PX);
  const H = Math.round(LOCO.h * PX);
  const p = makeCanvas(W, H);
  const { ctx } = p;
  const base = H - 8; // underframe line (wheels hang below)
  // underframe
  ctx.fillStyle = LIVERY.iron;
  ctx.fillRect(2, base - 4, W - 4, 6);
  ctx.fillStyle = LIVERY.red;
  ctx.fillRect(W - 6, base - 9, 6, 9); // buffer beam
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(W - 2, base - 7, 2, 2);
  ctx.fillRect(0, base - 7, 2, 2);
  // boiler
  const bx = 30;
  const bTop = base - 26;
  ctx.fillStyle = LIVERY.seafoam;
  ctx.fillRect(bx, bTop, W - bx - 6, 22);
  ctx.fillStyle = LIVERY.seafoamDark;
  ctx.fillRect(bx, bTop + 15, W - bx - 6, 7);
  ctx.fillStyle = shade(LIVERY.seafoam, 0.25);
  ctx.fillRect(bx, bTop + 3, W - bx - 6, 3);
  // smokebox front
  ctx.fillStyle = LIVERY.iron;
  ctx.fillRect(W - 14, bTop - 1, 8, 24);
  ctx.fillStyle = LIVERY.ironLight;
  ctx.fillRect(W - 13, bTop + 1, 2, 20);
  // brass boiler bands
  for (const x of [bx + 10, bx + 28, bx + 46]) {
    ctx.fillStyle = LIVERY.brass;
    ctx.fillRect(x, bTop, 2, 22);
  }
  // chimney + dome + whistle
  ctx.fillStyle = LIVERY.iron;
  ctx.fillRect(W - 20, bTop - 12, 7, 12);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(W - 22, bTop - 14, 11, 3);
  ctx.fillStyle = LIVERY.brass;
  ctx.beginPath();
  ctx.ellipse(bx + 30, bTop, 7, 6, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = LIVERY.brassLight;
  ctx.fillRect(bx + 26, bTop - 5, 3, 2);
  // headlamp
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(W - 9, bTop - 6, 5, 5);
  ctx.fillStyle = '#fff4c2';
  ctx.fillRect(W - 6, bTop - 5, 2, 3);
  // cab
  const cTop = 6;
  ctx.fillStyle = LIVERY.seafoam;
  ctx.fillRect(2, cTop + 6, 30, base - cTop - 6);
  ctx.fillStyle = LIVERY.cream;
  ctx.fillRect(2, cTop + 6, 30, 9);
  ctx.fillStyle = LIVERY.seafoamDark;
  ctx.fillRect(2, base - 8, 30, 4);
  // cab roof (cream, rounded) with brass rail
  ctx.fillStyle = LIVERY.cream;
  ctx.fillRect(0, cTop + 2, 34, 4);
  ctx.fillStyle = LIVERY.creamShade;
  ctx.fillRect(0, cTop + 5, 34, 1);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(1, cTop, 32, 2);
  // porthole window
  ctx.fillStyle = LIVERY.brass;
  ctx.beginPath();
  ctx.arc(16, cTop + 19, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#bfeef0';
  ctx.beginPath();
  ctx.arc(16, cTop + 19, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(13, cTop + 16, 2, 2);
  // driver silhouette (cosy)
  ctx.fillStyle = '#e46a5c';
  ctx.fillRect(16, cTop + 20, 5, 4);
  ctx.fillStyle = '#f4c9a4';
  ctx.fillRect(17, cTop + 17, 3, 3);
  // cream waist band along the boiler side tank
  ctx.fillStyle = LIVERY.cream;
  ctx.fillRect(32, base - 12, W - 38, 5);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(32, base - 12, W - 38, 1);
  rivets(ctx, 34, W - 10, base - 9, 4);
  // outline pass (1px dark edge for sprite readability)
  outline(p.canvas, '#22343a');
  return p.canvas;
}

/** Glass aquarium carriage: chassis + frame with a transparent window cut-out. */
export function paintCarriage(seed: number): HTMLCanvasElement {
  const W = Math.round(CAR.w * PX);
  const H = Math.round(CAR.h * PX);
  const p = makeCanvas(W, H);
  const { ctx } = p;
  const r = rng(seed);
  const wx = Math.round(TANK_WINDOW.x * PX);
  const ww = Math.round(TANK_WINDOW.w * PX);
  const wy = H - Math.round((TANK_WINDOW.y + TANK_WINDOW.h) * PX);
  const wh = Math.round(TANK_WINDOW.h * PX);
  const base = H - 6;
  // underframe
  ctx.fillStyle = LIVERY.iron;
  ctx.fillRect(4, base - 3, W - 8, 5);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(0, base - 2, 4, 2);
  ctx.fillRect(W - 4, base - 2, 4, 2);
  // lower body (seafoam) and roof (cream)
  ctx.fillStyle = LIVERY.seafoam;
  ctx.fillRect(2, wy - 4, W - 4, base - wy + 1);
  ctx.fillStyle = LIVERY.seafoamDark;
  ctx.fillRect(2, base - 5, W - 4, 3);
  ctx.fillStyle = LIVERY.cream;
  ctx.fillRect(1, wy - 9, W - 2, 6);
  ctx.fillStyle = LIVERY.creamShade;
  ctx.fillRect(1, wy - 4, W - 2, 1);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(3, wy - 11, W - 6, 2);
  // roof lantern vents
  for (let x = 14; x < W - 14; x += 18) {
    ctx.fillStyle = LIVERY.creamShade;
    ctx.fillRect(x, wy - 13, 6, 2);
  }
  // cream band below window with brass trim and a little crest
  ctx.fillStyle = LIVERY.cream;
  ctx.fillRect(2, wy + wh + 2, W - 4, 4);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(2, wy + wh + 6, W - 4, 1);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(Math.floor(W / 2) - 3, wy + wh + 8, 6, 4);
  ctx.fillStyle = LIVERY.red;
  ctx.fillRect(Math.floor(W / 2) - 1, wy + wh + 9, 2, 2);
  // brass window frame + rivets
  ctx.fillStyle = LIVERY.brassDark;
  ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(wx - 2, wy - 2, ww + 4, 1);
  ctx.fillRect(wx - 2, wy - 2, 1, wh + 4);
  rivets(ctx, wx, wx + ww, wy - 2, 4);
  rivets(ctx, wx, wx + ww, wy + wh + 1, 4);
  // cut the window out (the tank interior shows through)
  ctx.clearRect(wx, wy, ww, wh);
  // glass mullions every third
  ctx.fillStyle = LIVERY.brassDark;
  for (const fx of [1 / 3, 2 / 3]) ctx.fillRect(wx + Math.round(ww * fx), wy, 1, wh);
  void r;
  outline(p.canvas, '#22343a');
  return p.canvas;
}

/** Spoked wheel sprite (rotated in 3D). */
export function paintWheel(spokes: number, red: boolean): HTMLCanvasElement {
  const S = 24;
  const p = makeCanvas(S, S);
  const { ctx } = p;
  const c = S / 2;
  ctx.fillStyle = '#2a383c';
  ctx.beginPath();
  ctx.arc(c, c, c - 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = red ? LIVERY.red : LIVERY.ironLight;
  ctx.beginPath();
  ctx.arc(c, c, c - 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a383c';
  ctx.lineWidth = 2;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a) * (c - 3), c + Math.sin(a) * (c - 3));
    ctx.stroke();
  }
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(c - 2, c - 2, 4, 4);
  ctx.fillStyle = '#c9d2d6';
  ctx.beginPath();
  ctx.arc(c, c, c - 0.5, 0, Math.PI * 2);
  ctx.arc(c, c, c - 1.5, 0, Math.PI * 2, true);
  ctx.fill();
  return p.canvas;
}

/** Soft round puff for steam particles. */
export function paintPuff(): HTMLCanvasElement {
  const p = makeCanvas(64, 64);
  const g = p.ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.6, 'rgba(250,250,245,0.6)');
  g.addColorStop(1, 'rgba(250,250,245,0)');
  p.ctx.fillStyle = g;
  p.ctx.fillRect(0, 0, 64, 64);
  return p.canvas;
}

/** 1px dark outline around every opaque pixel (matches scripts/pixelize.ts convention). */
export function outline(canvas: HTMLCanvasElement, color: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : (src.data[(y * w + x) * 4 + 3] ?? 0));
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) > 0) continue;
      if (a(x - 1, y) > 128 || a(x + 1, y) > 128 || a(x, y - 1) > 128 || a(x, y + 1) > 128) ctx.fillRect(x, y, 1, 1);
    }
  }
}
