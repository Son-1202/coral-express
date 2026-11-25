import { makeCanvas } from '../paint/canvas';

/** Depot palette per Line (art direction only). */
export interface DepotPalette {
  wall: string;
  wallDark: string;
  trim: string;
  roof: string;
  roofDark: string;
  ground: string;
  sky: string;
}

export const DEPOT_PALETTE: Record<number, DepotPalette> = {
  1: { wall: '#bfe0cf', wallDark: '#8fbfa9', trim: '#f4ead2', roof: '#4f7f9c', roofDark: '#3b627a', ground: '#cdb98f', sky: '#cfe9ee' },
  2: { wall: '#b04a3a', wallDark: '#86352a', trim: '#f2efe8', roof: '#5f6a73', roofDark: '#475058', ground: '#9aa39a', sky: '#d3dde3' },
  3: { wall: '#c99b5e', wallDark: '#9c7342', trim: '#e9d7a8', roof: '#a7834b', roofDark: '#7d5f33', ground: '#5d5552', sky: '#f3d7b7' },
};

/** Back wall of the engine shed (cut-away diorama): planks, tall windows, trim. */
export function paintShedBack(p: DepotPalette, w = 320, h = 128): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.ctx;
  g.fillStyle = p.wall;
  g.fillRect(0, 0, w, h);
  g.fillStyle = p.wallDark;
  for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 1, h);
  // windows
  for (let i = 0; i < 4; i++) {
    const x = 24 + i * 76;
    g.fillStyle = p.trim;
    g.fillRect(x - 3, 22, 46, 54);
    g.fillStyle = '#2d4750';
    g.fillRect(x, 25, 40, 48);
    g.fillStyle = 'rgba(190,230,240,0.55)';
    g.fillRect(x + 2, 27, 16, 20);
    g.fillRect(x + 22, 27, 16, 20);
    g.fillRect(x + 2, 51, 16, 20);
    g.fillRect(x + 22, 51, 16, 20);
  }
  g.fillStyle = p.trim;
  g.fillRect(0, h - 10, w, 4);
  g.fillRect(0, 0, w, 4);
  return c.canvas;
}

/** Gabled roof seen from the side, with a little ventilator lantern and a "DEPOT" plaque. */
export function paintShedRoof(p: DepotPalette, w = 340, h = 64): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.ctx;
  g.fillStyle = p.roofDark;
  g.fillRect(0, h - 14, w, 14);
  g.fillStyle = p.roof;
  g.fillRect(6, 22, w - 12, h - 34);
  g.fillStyle = p.roofDark;
  for (let x = 10; x < w - 10; x += 10) g.fillRect(x, 22, 2, h - 34);
  // ventilator lantern
  g.fillStyle = p.trim;
  g.fillRect(w / 2 - 40, 4, 80, 18);
  g.fillStyle = p.roofDark;
  g.fillRect(w / 2 - 46, 0, 92, 6);
  g.fillStyle = '#2d4750';
  for (let i = 0; i < 5; i++) g.fillRect(w / 2 - 34 + i * 15, 9, 8, 10);
  // plaque
  g.fillStyle = '#c9a34a';
  g.fillRect(w / 2 - 34, h - 13, 68, 12);
  g.fillStyle = '#3a2a1a';
  g.font = 'bold 10px "Pixelify Sans", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DEPOT', w / 2, h - 7);
  return c.canvas;
}

/** Front pillar (cut-away: only the posts stand in front of the train). */
export function paintPillar(p: DepotPalette): HTMLCanvasElement {
  const c = makeCanvas(10, 128);
  const g = c.ctx;
  g.fillStyle = p.trim;
  g.fillRect(0, 0, 10, 128);
  g.fillStyle = p.wallDark;
  g.fillRect(7, 0, 3, 128);
  g.fillRect(0, 0, 10, 6);
  return c.canvas;
}

/** Rails strip (side view): rail, sleepers, ballast. */
export function paintRails(w = 256, h = 16): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.ctx;
  g.fillStyle = '#7c7064';
  g.fillRect(0, 6, w, h - 6);
  g.fillStyle = '#5a4030';
  for (let x = 0; x < w; x += 12) g.fillRect(x, 5, 8, 5);
  g.fillStyle = '#b9c1c4';
  g.fillRect(0, 2, w, 3);
  g.fillStyle = '#6f7a80';
  g.fillRect(0, 4, w, 1);
  return c.canvas;
}

/** The depot pool: a stone-rimmed oval pond, seen from slightly above. */
export function paintPool(w = 256, h = 80): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.ctx;
  g.fillStyle = '#8d8577';
  g.beginPath();
  g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
  g.fill();
  const water = g.createLinearGradient(0, 8, 0, h - 8);
  water.addColorStop(0, '#7fd3d1');
  water.addColorStop(1, '#2f8f9c');
  g.fillStyle = water;
  g.beginPath();
  g.ellipse(w / 2, h / 2 + 2, w / 2 - 12, h / 2 - 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#a79f90';
  for (let a = 0; a < Math.PI * 2; a += 0.22) {
    const x = w / 2 + Math.cos(a) * (w / 2 - 6);
    const y = h / 2 + Math.sin(a) * (h / 2 - 5);
    g.fillRect(Math.round(x - 4), Math.round(y - 3), 8, 6);
  }
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(w * 0.3, h * 0.35, 30, 2);
  g.fillRect(w * 0.55, h * 0.55, 22, 2);
  return c.canvas;
}
