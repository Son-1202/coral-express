/**
 * Tank-local asset loader. Tries candidate URLs in order (final art path first, then the
 * ART pipeline's `_cut/` folder); only files listed by `virtual:asset-list` are requested,
 * so a missing file never 404s and the procedural placeholder stays in use.
 */
import * as THREE from 'three';
import existingFiles from 'virtual:asset-list';
import { shinyTint } from '../train/fishMaterial';
import { fishSource } from './fishSource';

const available = new Set<string>(existingFiles);

export function firstExisting(candidates: readonly string[]): string | null {
  for (const c of candidates) if (available.has(c)) return c;
  return null;
}

/** `texture.userData.aspect` (w/h) is kept up to date when the real image arrives. */
export function tankTexture(
  candidates: readonly string[],
  placeholder: () => HTMLCanvasElement,
  transform?: (img: HTMLImageElement) => HTMLCanvasElement,
): THREE.Texture {
  const ph = placeholder();
  const tex: THREE.Texture = new THREE.Texture(ph);
  setup(tex, ph.width, ph.height);
  const url = firstExisting(candidates);
  if (url) {
    const img = new Image();
    img.onload = () => {
      tex.dispose(); // size changes: drop the immutable GPU storage so it re-uploads
      const src = transform ? transform(img) : img;
      tex.image = src;
      if (src instanceof HTMLImageElement) setup(tex, src.naturalWidth, src.naturalHeight);
      else setup(tex, src.width, src.height);
    };
    img.src = url;
  }
  return tex;
}

/** Fish sprite texture; shiny fish load `<id>_shiny.png` (or a tinted copy of the normal art). */
export function fishTankTexture(id: string, shiny: boolean, placeholder: () => HTMLCanvasElement): THREE.Texture {
  const src = fishSource(id, shiny, (u) => available.has(u));
  return tankTexture(src.url ? [src.url] : [], placeholder, src.tint ? shinyTint : undefined);
}

function setup(tex: THREE.Texture, w: number, h: number): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  // Big source art (not yet pixelized) needs mipmaps to downscale cleanly.
  const big = Math.max(w, h) > 256;
  tex.minFilter = big ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  tex.generateMipmaps = big;
  tex.userData.aspect = w / Math.max(1, h);
  tex.needsUpdate = true;
}

export { fishUrls } from './fishSource';
export const plantUrls = (id: string): string[] => [`/plants/${id}.png`, `/_cut/plants/${id}.png`];
export const decorUrls = (id: string): string[] => [`/decor/${id}.png`, `/_cut/decor/${id}.png`];
const SIGHT_ART: Record<string, string> = { dolphin_race: 'dolphin', seagull_thief: 'gull', whale_breach: 'whale' };
export const sightUrls = (id: string): string[] => {
  const a = SIGHT_ART[id] ?? id;
  return [`/sights/${id}.png`, `/sights/${a}.png`, `/_cut/sights/${a}.png`];
};
export const backdropUrls = (habitat: string, variant: string): string[] => [
  `/tank/${variant}.png`, `/tank/backdrop_${habitat}.png`, `/train/interior_${habitat}.png`, `/_cut/train/interior_${habitat}.png`,
];
export const coastUrls = (line: number): string[] => [`/scenery/l${line}/far.png`, `/_cut/scenery/l${line}_far.png`];
export const frameUrls = (n: number): string[] => [`/ui/photo_frames_${n}.png`, `/_cut/ui/photo_frames_${n}.png`];
