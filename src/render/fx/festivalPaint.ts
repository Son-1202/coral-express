import { makeCanvas } from '../paint/canvas';

/**
 * T-38 procedural fallbacks for the Festival Station decor (used only while
 * `festival/*.png` is missing). Same layout rules as the art: the cord runs along
 * the top edge of the tileable strips; the flag's pole stands at the left.
 */
const PALETTE = ['#f08a8a', '#8fd6c0', '#f4cf7a', '#8cc3ea', '#c3a6e6', '#f6ecd8'];

/** Tileable pennant garland, cord on row 2. */
export function paintBuntingStrip(): HTMLCanvasElement {
  const p = makeCanvas(96, 14);
  const { ctx } = p;
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(0, 1, 96, 2);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = PALETTE[i % PALETTE.length] ?? '#f08a8a';
    for (let y = 0; y < 11; y++) {
      const half = Math.max(0, 5 - y * 0.47);
      ctx.fillRect(i * 12 + 6 - half, 3 + y, half * 2, 1);
    }
  }
  return p.canvas;
}

/** Tileable string of round paper lanterns, cord on row 1. */
export function paintLanternStrip(): HTMLCanvasElement {
  const p = makeCanvas(64, 20);
  const { ctx } = p;
  ctx.fillStyle = '#4a3a2c';
  ctx.fillRect(0, 1, 64, 1);
  for (let i = 0; i < 4; i++) {
    const cx = i * 16 + 8;
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(cx, 2, 1, 4);
    ctx.fillStyle = PALETTE[(i * 2) % PALETTE.length] ?? '#f4cf7a';
    ctx.beginPath();
    ctx.ellipse(cx + 0.5, 12, 5.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(cx - 1, 10, 3, 4);
    ctx.fillStyle = '#b08a3c';
    ctx.fillRect(cx - 2, 5, 5, 1);
    ctx.fillRect(cx - 2, 18, 5, 1);
  }
  return p.canvas;
}

/** Pennant flag on a short brass pole (pole column ≈ 0.17 of the width, like the art). */
export function paintFlag(): HTMLCanvasElement {
  const p = makeCanvas(30, 38);
  const { ctx } = p;
  ctx.fillStyle = '#8a6236';
  ctx.fillRect(4, 2, 2, 34);
  ctx.fillStyle = '#c9a04a';
  ctx.fillRect(3, 0, 4, 3);
  ctx.fillRect(2, 35, 6, 3);
  ctx.fillStyle = '#f08a8a';
  for (let y = 0; y < 13; y++) {
    const len = Math.round(23 * (1 - Math.abs(y - 6) / 7));
    ctx.fillRect(6, 4 + y, len, 1);
  }
  ctx.fillStyle = '#f6ecd8';
  ctx.fillRect(6, 10, 14, 1);
  return p.canvas;
}

/** Small paper square in palette colour `i`. */
export function paintConfetti(i: number): HTMLCanvasElement {
  const p = makeCanvas(4, 3);
  p.ctx.fillStyle = PALETTE[i % PALETTE.length] ?? '#f4cf7a';
  p.ctx.fillRect(0, 0, 4, 3);
  return p.canvas;
}
