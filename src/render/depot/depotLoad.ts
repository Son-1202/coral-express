import * as THREE from 'three';
import { PATHS, fileUrl, hasFile, type DepotArtKind } from '../../assets';
import { findDoorway, findWater, opaqueBox, type PxRect, type Rgba } from './depotArt';

/**
 * Depot art loader (T-35). Own promise-per-path cache: the scene is rebuilt on every Depot Reset,
 * so a texture `onLoad` that only fires for the first requester is not enough. Every result is
 * analysed once (doorway / water band) and kept as canvases ready to wrap in textures.
 */
const imgs = new Map<string, Promise<HTMLImageElement | null>>();
const done = new Map<string, HTMLImageElement | null>();

export function loadImage(path: string, webp = false): Promise<HTMLImageElement | null> {
  const key = `${path}|${webp}`;
  let p = imgs.get(key);
  if (!p) {
    p = new Promise((resolve) => {
      if (!hasFile(path)) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = fileUrl(path, webp);
    });
    p.then((v) => done.set(key, v));
    imgs.set(key, p);
  }
  return p;
}

/** Already-loaded image (or null while loading / missing). */
export function loaded(path: string, webp = false): HTMLImageElement | null {
  return done.get(`${path}|${webp}`) ?? null;
}

function pixels(img: HTMLImageElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; rgba: Rgba } {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { canvas, ctx, rgba: { data: d.data, width: d.width, height: d.height } };
}

export interface ShedArt {
  img: HTMLImageElement;
  /** Shed with the doorway opening punched out (drawn in front of the train). */
  front: HTMLCanvasElement;
  door: PxRect;
  box: PxRect;
}

export interface PoolArt {
  img: HTMLImageElement;
  /** Pool with the water made see-through (drawn over the swimming fish). */
  front: HTMLCanvasElement;
  inner: PxRect;
  water: PxRect;
}

export interface DepotArt {
  shed: ShedArt | null;
  pool: PoolArt | null;
  yard: HTMLImageElement | null;
  buffer: { img: HTMLImageElement; box: PxRect } | null;
}

const art: DepotArt = { shed: null, pool: null, yard: null, buffer: null };
let started = false;

/** Opacity of the water drawn over the pool fish (lower = clearer fish). */
const WATER_OVER = 0.42;

function analyseShed(img: HTMLImageElement): ShedArt | null {
  const { canvas, ctx, rgba } = pixels(img);
  const door = findDoorway(rgba);
  if (!door) return null;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < door.mask.length; i++) if (door.mask[i]) d.data[i * 4 + 3] = 0;
  ctx.putImageData(d, 0, 0);
  return { img, front: canvas, door: door.rect, box: opaqueBox(rgba) };
}

function analysePool(img: HTMLImageElement): PoolArt | null {
  const { canvas, ctx, rgba } = pixels(img);
  const w = findWater(rgba);
  if (!w) return null;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < w.region.mask.length; i++) if (w.region.mask[i]) d.data[i * 4 + 3] = Math.round(d.data[i * 4 + 3]! * WATER_OVER);
  ctx.putImageData(d, 0, 0);
  return { img, front: canvas, inner: w.inner, water: w.region.rect };
}

/** Starts loading + analysing every depot sprite (idempotent). Resolves when all settled. */
export function preloadDepotArt(): Promise<DepotArt> {
  const kinds: DepotArtKind[] = ['shed', 'pool', 'yard', 'buffer'];
  const all = kinds.map((k) =>
    loadImage(PATHS.depot(k)).then((img) => {
      if (!img) return;
      try {
        if (k === 'shed') art.shed = analyseShed(img);
        else if (k === 'pool') art.pool = analysePool(img);
        else if (k === 'yard') art.yard = img;
        else art.buffer = { img, box: opaqueBox(pixels(img).rgba) };
      } catch {
        /* tainted / broken image: keep the procedural fallback */
      }
    }),
  );
  started = true;
  return Promise.all(all).then(() => art);
}

/** What has loaded so far (fallback painters fill in the rest). */
export function depotArt(): DepotArt {
  if (!started) void preloadDepotArt();
  return art;
}

export function texOf(src: HTMLCanvasElement | HTMLImageElement, pixel = true): THREE.Texture {
  const t = new THREE.Texture(src);
  t.colorSpace = THREE.SRGBColorSpace;
  if (pixel) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
  } else t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
