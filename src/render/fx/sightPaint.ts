import * as THREE from 'three';
import { makeCanvas, toTexture } from '../paint/canvas';

/** Procedural placeholders + props for the Sights (used when no art exists). */
function blob(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): () => HTMLCanvasElement {
  return () => {
    const p = makeCanvas(w, h);
    draw(p.ctx);
    return p.canvas;
  };
}

export const paintDolphin = blob(24, 10, (c) => {
  c.fillStyle = '#6f94b4';
  c.fillRect(3, 3, 16, 5);
  c.fillRect(18, 4, 4, 2);
  c.fillRect(10, 1, 3, 2);
  c.fillRect(0, 2, 3, 2);
  c.fillRect(0, 6, 3, 2);
  c.fillStyle = '#dfeaf2';
  c.fillRect(6, 6, 11, 2);
  c.fillStyle = '#1d2b33';
  c.fillRect(17, 4, 1, 1);
});

export const paintGull = blob(16, 12, (c) => {
  c.fillStyle = '#f7f7f2';
  c.fillRect(4, 4, 8, 5);
  c.fillRect(11, 2, 3, 3);
  c.fillStyle = '#9aa4ad';
  c.fillRect(2, 4, 6, 2);
  c.fillStyle = '#f2a33c';
  c.fillRect(14, 3, 2, 1);
  c.fillRect(6, 9, 1, 3);
  c.fillRect(9, 9, 1, 3);
  c.fillStyle = '#1d2b33';
  c.fillRect(12, 3, 1, 1);
});

export const paintWhale = blob(64, 26, (c) => {
  c.fillStyle = '#4d6f8c';
  c.beginPath();
  c.ellipse(30, 14, 26, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.fillRect(0, 6, 8, 5);
  c.fillRect(0, 15, 8, 5);
  c.fillStyle = '#c9d8e2';
  c.fillRect(14, 18, 34, 4);
  c.fillStyle = '#1d2b33';
  c.fillRect(46, 11, 2, 2);
});

let flagTex: THREE.Texture | null = null;
/** A string of pennants (repeats horizontally). */
export function buntingTex(): THREE.Texture {
  if (flagTex) return flagTex;
  const p = makeCanvas(96, 14);
  const cols = ['#e45b4f', '#ffd447', '#2aa5a0', '#4c84c4', '#ff9a52', '#b98cf0'];
  p.ctx.fillStyle = '#6b4a2c';
  p.ctx.fillRect(0, 0, 96, 2);
  for (let i = 0; i < 12; i++) {
    p.ctx.fillStyle = cols[i % cols.length] ?? '#e45b4f';
    for (let y = 0; y < 11; y++) {
      const half = Math.max(0, 3.5 - y * 0.33);
      p.ctx.fillRect(i * 8 + 4 - half, 2 + y, half * 2, 1);
    }
  }
  flagTex = toTexture(p, true);
  flagTex.wrapS = THREE.RepeatWrapping;
  return flagTex;
}

let ringTex: THREE.Texture | null = null;
/** Pulsing "tap here" ring: dashed cream + brass ellipse outline. */
export function tapRingTex(): THREE.Texture {
  if (ringTex) return ringTex;
  const p = makeCanvas(96, 64);
  const { ctx } = p;
  const ring = (lw: number, col: string, dash: number[]) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.ellipse(48, 32, 44, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
  };
  ring(6, '#9c7430', []);
  ring(4, '#fff6d8', [10, 6]);
  ringTex = toTexture(p, true);
  return ringTex;
}

let sprayTex: THREE.Texture | null = null;
/** Tall splash fountain (stowaway jumping in through the roof hatch). */
export function fountainTex(): THREE.Texture {
  if (sprayTex) return sprayTex;
  const p = makeCanvas(24, 28);
  const { ctx } = p;
  const cols = ['#e9fbff', '#9fe3ef', '#4fc6d3'];
  const rows: [number, number, number][] = [
    [4, 11, 2], [6, 9, 6], [8, 7, 10], [11, 6, 12], [14, 5, 14], [18, 4, 16], [22, 2, 20], [25, 1, 22],
  ];
  for (const [y, x, w] of rows) {
    ctx.fillStyle = cols[2] as string;
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = cols[1] as string;
    ctx.fillRect(x + 1, y, w - 2, 2);
    ctx.fillStyle = cols[0] as string;
    ctx.fillRect(x + Math.floor(w / 3), y, Math.max(1, Math.floor(w / 4)), 1);
  }
  for (const [x, y] of [[3, 3], [19, 1], [8, 0], [15, 5], [1, 12], [22, 10]] as const) {
    ctx.fillStyle = cols[1] as string;
    ctx.fillRect(x, y, 2, 2);
  }
  sprayTex = toTexture(p, true);
  return sprayTex;
}
