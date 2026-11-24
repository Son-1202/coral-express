import * as THREE from 'three';

/** Small deterministic RNG (mulberry32) so procedural paintings are stable between loads. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Paint {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export function makeCanvas(w: number, h: number): Paint {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { canvas, ctx, w, h };
}

export function toTexture(p: Paint | HTMLCanvasElement, pixel = false): THREE.CanvasTexture {
  const c = p instanceof HTMLCanvasElement ? p : p.canvas;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (pixel) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
  } else {
    t.anisotropy = 4;
  }
  return t;
}

/**
 * Gouache-like grain: many tiny low-alpha dabs of light and dark, only where
 * the canvas is already painted (source-atop).
 */
export function grain(p: Paint, seed: number, amount = 0.06, density = 0.012): void {
  const r = rng(seed);
  const { ctx, w, h } = p;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const n = Math.floor(w * h * density);
  for (let i = 0; i < n; i++) {
    const light = r() < 0.5;
    ctx.fillStyle = light ? `rgba(255,250,235,${amount * r()})` : `rgba(40,30,60,${amount * r()})`;
    const s = 1 + r() * 2.5;
    ctx.fillRect(r() * w, r() * h, s, s * (0.5 + r()));
  }
  ctx.restore();
}

/** Draw `fn` at x, x-w and x+w so horizontally tiling textures wrap seamlessly. */
export function wrapDraw(w: number, x: number, span: number, fn: (x: number) => void): void {
  fn(x);
  if (x - span < 0) fn(x + w);
  if (x + span > w) fn(x - w);
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length) % arr.length] as T;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
}
