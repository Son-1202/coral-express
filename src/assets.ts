import * as THREE from 'three';
import existingFiles from 'virtual:asset-list';

/**
 * Asset manifest.
 *
 * Convention: the repo folder `assets/` is Vite's `publicDir` (see vite.config.ts),
 * so the file `assets/fish/clownfish.png` is served at the URL `/fish/clownfish.png`.
 * ART (via scripts/pixelize.ts / optimize-assets.ts) drops final files at the paths
 * below; until a file exists the game paints a procedural placeholder instead.
 * Missing files are never requested (the list of existing files comes from the
 * build-time `virtual:asset-list` module), so there is no 404 noise and no crash.
 *
 * Painterly layers prefer the `.webp` sibling when it exists (≈10× smaller).
 */
export const ASSETS = {
  'train.locomotive': '/train/locomotive.png',
  'train.carriage': '/train/car_shell.png',
  'train.wheel': '/train/wheel.png',
  'train.rod': '/train/rod.png',
  'icons.heart_bubble': '/icons/heart_bubble.png',
} as const;

export type AssetKey = keyof typeof ASSETS;

export type ForeKind = 'wall' | 'ground' | 'lens_1' | 'lens_2' | 'lens_3' | 'planter';

/** Dynamic manifest paths (all relative to `assets/`). */
export const PATHS = {
  fish: (id: string, shiny = false) => `/fish/${id}${shiny ? '_shiny' : ''}.png`,
  interior: (habitat: string) => `/train/interior_${habitat}.png`,
  scenery: (line: number, layer: 'far' | 'mid' | 'near') => `/scenery/l${line}_${layer}.png`,
  /** T-31/T-32 painted foreground band per Line: wall, ground (fence + meadow), lens clumps, planter. */
  fore: (line: number, kind: ForeKind) => `/scenery/l${line}_${kind}.png`,
  /** T-31/T-32 shared ballast + sleepers (seen from above; rails stay code-drawn). */
  trackbed: '/scenery/trackbed.png',
  station: (line: number) => `/station/l${line}.png`,
  passenger: (n: number) => `/passengers/p${n}.png`,
  sight: (id: string) => `/sights/${id}.png`,
  wildlife: (id: string) => `/wildlife/${id}.png`,
  plant: (id: string) => `/plants/${id}.png`,
  decor: (id: string) => `/decor/${id}.png`,
  /** T-34/T-35 Depot Reset scene art (keyed shed / pool / buffer, tileable opaque yard). */
  depot: (kind: DepotArtKind) => `/depot/${kind}.png`,
  /** T-34 optional per-Line depot backdrop (21:9, opaque); the Line's far scenery is used when missing. */
  depotBackdrop: (line: number) => `/depot/backdrop_l${line}.png`,
  /** Far scenery time-of-day variant (`l<n>_far_{morning,dusk,night}`; afternoon = plain `l<n>_far`). */
  sceneryFar: (line: number, tod: FarVariant) => `/scenery/l${line}_far${tod === 'day' ? '' : `_${tod}`}.png`,
} as const;

export type DepotArtKind = 'shed' | 'yard' | 'pool' | 'buffer';
export type FarVariant = 'day' | 'morning' | 'dusk' | 'night';

const available = new Set(existingFiles);

export function assetUrl(key: AssetKey): string {
  return ASSETS[key];
}

export function hasAsset(key: AssetKey): boolean {
  return available.has(ASSETS[key]);
}

/** True when the file (or its .webp sibling for .png paths) exists. */
export function hasFile(path: string): boolean {
  return available.has(path) || available.has(path.replace(/\.png$/, '.webp'));
}

/** Best URL for a path: .webp sibling when present (painterly layers), else the path. */
export function fileUrl(path: string, preferWebp = false): string {
  const webp = path.replace(/\.png$/, '.webp');
  if (preferWebp && available.has(webp)) return webp;
  if (available.has(path)) return path;
  return available.has(webp) ? webp : path;
}

export interface TexOpts {
  pixel?: boolean;
  /** Prefer the .webp sibling (painterly art). */
  webp?: boolean;
  /** Called once the real image has replaced the placeholder. */
  onLoad?: (img: HTMLImageElement) => void;
  /** Post-process the loaded image into a canvas (e.g. shiny tint). */
  transform?: (img: HTMLImageElement) => HTMLCanvasElement;
}

function makeTex(src: HTMLCanvasElement | HTMLImageElement, pixel: boolean): THREE.Texture {
  const tex = new THREE.Texture(src);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (pixel) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
  } else {
    tex.anisotropy = 4;
  }
  return tex;
}

/**
 * Returns a texture immediately. It starts as the procedural placeholder from
 * `placeholder()`; if the real file exists it is loaded and swapped in.
 * Any load failure silently keeps the placeholder.
 */
export function loadTextureUrl(path: string, placeholder: () => HTMLCanvasElement, opts: TexOpts = {}): THREE.Texture {
  const tex = makeTex(placeholder(), !!opts.pixel);
  if (hasFile(path)) {
    const img = new Image();
    img.onload = () => {
      // the GPU storage was sized for the placeholder: free it so the real image re-allocates
      tex.dispose();
      tex.image = opts.transform ? opts.transform(img) : img;
      tex.needsUpdate = true;
      opts.onLoad?.(img);
    };
    img.onerror = () => {
      /* keep placeholder */
    };
    img.src = fileUrl(path, !!opts.webp);
  }
  return tex;
}

export function loadTexture(key: AssetKey, placeholder: () => HTMLCanvasElement, opts: TexOpts = {}): THREE.Texture {
  return loadTextureUrl(ASSETS[key], placeholder, opts);
}

const cache = new Map<string, THREE.Texture>();
/** Cached variant of loadTextureUrl (shared by every sprite of the same file). */
export function sharedTexture(path: string, placeholder: () => HTMLCanvasElement, opts: TexOpts = {}): THREE.Texture {
  const k = `${path}|${opts.transform ? 't' : ''}`;
  let t = cache.get(k);
  if (!t) {
    t = loadTextureUrl(path, placeholder, opts);
    cache.set(k, t);
  }
  return t;
}
