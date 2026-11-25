import * as THREE from 'three';
import { makeCanvas } from '../paint/canvas';

/** Deterministic hash → [0,1) for (a, b, salt). Render-only placement (no sim RNG). */
export function hash01(a: number, b: number, salt = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Small seeded RNG (mulberry32). */
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

/**
 * World position at depth `z` that projects onto the train plane (z = 0) at
 * (x0, y0), for a camera at `cam`. Lets actors be placed "on screen" at any depth.
 */
export function atDepth(cam: THREE.Vector3, x0: number, y0: number, z: number): { x: number; y: number } {
  const k = (cam.z - z) / cam.z;
  return { x: cam.x + (x0 - cam.x) * k, y: cam.y + (y0 - cam.y) * k };
}

/** Half the visible width at the train plane (world units). */
export function halfWidth(cam: THREE.PerspectiveCamera): number {
  const h = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z;
  return h * cam.aspect;
}

/** 2×2 transparent placeholder (sprites stay hidden until their art loads). */
export function emptyCanvas(): HTMLCanvasElement {
  return makeCanvas(2, 2).canvas;
}

/** Image size of a texture (placeholder → tiny). */
export function texSize(t: THREE.Texture): { w: number; h: number } {
  const img = t.image as { width?: number; height?: number } | undefined;
  return { w: img?.width ?? 2, h: img?.height ?? 2 };
}

/** Unit plane with its origin at the bottom centre (sprites stand on the ground). */
export const FOOT_GEO = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
export const CENTER_GEO = new THREE.PlaneGeometry(1, 1);

/** Soft white blob (smoke, fog, clouds). */
let soft: THREE.CanvasTexture | null = null;
export function softPuff(): THREE.Texture {
  if (soft) return soft;
  const p = makeCanvas(128, 128);
  const g = p.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  p.ctx.fillStyle = g;
  p.ctx.fillRect(0, 0, 128, 128);
  soft = new THREE.CanvasTexture(p.canvas);
  soft.colorSpace = THREE.SRGBColorSpace;
  return soft;
}

/** Long soft horizontal band (fog bank). */
let band: THREE.CanvasTexture | null = null;
export function fogBand(): THREE.Texture {
  if (band) return band;
  const p = makeCanvas(256, 64);
  const r = rng(7);
  for (let i = 0; i < 40; i++) {
    const x = 20 + r() * 216;
    const y = 30 + (r() - 0.5) * 16;
    const rad = 14 + r() * 22;
    const g = p.ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    p.ctx.fillStyle = g;
    p.ctx.fillRect(0, 0, 256, 64);
  }
  band = new THREE.CanvasTexture(p.canvas);
  band.colorSpace = THREE.SRGBColorSpace;
  return band;
}
