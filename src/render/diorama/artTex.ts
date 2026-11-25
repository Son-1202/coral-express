import * as THREE from 'three';
import { fileUrl, hasFile } from '../../assets';

/**
 * T-32: load one painted scenery file. `onArt` runs with the decoded image and a
 * ready sRGB texture (mipmapped, linear: the 2k paintings are shown ~4–8× smaller).
 * `onMissing` runs instead when the file is not in the build or fails to load, so
 * the caller can fall back to its procedural painter — nothing procedural is shown
 * while a file that exists is still loading.
 */
export function loadArt(
  path: string,
  onArt: (img: HTMLImageElement, tex: THREE.Texture) => void,
  onMissing: () => void,
  o: { anisotropy?: number; maxW?: number } = {},
): void {
  if (!hasFile(path)) {
    onMissing();
    return;
  }
  const img = new Image();
  img.onload = () => {
    // the 2k paintings are shown far smaller: keep at most `maxW` px wide on the GPU (mipmaps do the rest)
    const tex = new THREE.Texture(o.maxW && img.naturalWidth > o.maxW ? downscale(img, o.maxW) : img);
    tex.anisotropy = o.anisotropy ?? 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    onArt(img, tex);
  };
  img.onerror = () => onMissing();
  img.src = fileUrl(path, true);
}

function downscale(img: HTMLImageElement, maxW: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = maxW;
  c.height = Math.max(1, Math.round((img.naturalHeight * maxW) / img.naturalWidth));
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }
  return c;
}

/** Horizontal repeat (and optional vertical sub-band, V measured from the image bottom) of a loaded texture. */
export function repeatX(tex: THREE.Texture, repeat: number, vFrom = 0, vTo = 1): THREE.Texture {
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(repeat, vTo - vFrom);
  tex.offset.set(0, vFrom);
  tex.needsUpdate = true;
  return tex;
}

/**
 * A canvas copy of the bottom band of an image (rows `fromFrac`…1), for surfaces
 * that need to repeat that band vertically too (the meadow below the fence).
 * Art pixels only — no painting. Downscaled to `maxW` to save GPU memory.
 */
export function cropBand(img: HTMLImageElement, fromFrac: number, maxW = 1280): HTMLCanvasElement {
  const sw = img.naturalWidth;
  const sy = Math.floor(img.naturalHeight * fromFrac);
  const sh = img.naturalHeight - sy;
  const k = Math.min(1, maxW / sw);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  c.getContext('2d')?.drawImage(img, 0, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
