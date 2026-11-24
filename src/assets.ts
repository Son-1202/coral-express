import * as THREE from 'three';
import existingFiles from 'virtual:asset-list';

/**
 * Asset manifest.
 *
 * Convention: the repo folder `assets/` is Vite's `publicDir` (see vite.config.ts),
 * so the file `assets/scenery/l1/far.png` is served at the URL `/scenery/l1/far.png`.
 * ART drops files at the paths below; until a file exists the game paints a
 * procedural placeholder instead. Missing files are never requested (the list of
 * existing files comes from the build-time `virtual:asset-list` module), so there
 * is no 404 noise and no crash.
 */
export const ASSETS = {
  'scenery.l1.sky': '/scenery/l1/sky.png',
  'scenery.l1.far': '/scenery/l1/far.png',
  'scenery.l1.mid': '/scenery/l1/mid.png',
  'scenery.l1.near': '/scenery/l1/near.png',
  'scenery.l1.station': '/scenery/l1/station.png',
  'train.locomotive': '/train/locomotive.png',
  'train.carriage': '/train/carriage.png',
  'train.wheel': '/train/wheel.png',
  'fish.clownfish': '/fish/clownfish.png',
  'fish.blue_tang': '/fish/blue_tang.png',
  'fish.seahorse': '/fish/seahorse.png',
} as const;

export type AssetKey = keyof typeof ASSETS;

const available = new Set(existingFiles);

export function assetUrl(key: AssetKey): string {
  return ASSETS[key];
}

export function hasAsset(key: AssetKey): boolean {
  return available.has(ASSETS[key]);
}

/**
 * Returns a texture immediately. It starts as the procedural placeholder from
 * `placeholder()`; if the real file exists it is loaded and swapped in.
 * Any load failure silently keeps the placeholder.
 */
export function loadTexture(
  key: AssetKey,
  placeholder: () => HTMLCanvasElement,
  opts: { pixel?: boolean } = {},
): THREE.Texture {
  const tex: THREE.Texture = new THREE.Texture(placeholder());
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.pixel) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
  }
  if (hasAsset(key)) {
    const img = new Image();
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
    };
    img.onerror = () => {
      /* keep placeholder */
    };
    img.src = assetUrl(key);
  }
  return tex;
}
