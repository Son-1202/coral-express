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
