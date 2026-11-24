import * as THREE from 'three';
import { PATHS, fileUrl, hasFile } from '../../assets';
import { LAYER_Z, WORLD } from './config';
import { TileLayer } from './tileLayer';

/**
 * Real painterly scenery for one Line (`scenery/l<n>_{far,mid,near}`), laid out
 * on the T-01 parallax rig. Each strip alternates the painting and its mirror so
 * tile seams always match. Layout numbers are render-only (no balance).
 */
export interface LineLayerSpec {
  layer: 'far' | 'mid' | 'near';
  z: number;
  /** Tile width in world units (height follows the image aspect). */
  width: number;
  /** World Y of a reference row of the painting. */
  anchorY: number;
  /** That row, as a fraction of the image height from the bottom. */
  anchorV: number;
  fog: boolean;
}

/** Far: horizon (≈ middle of the painting) at the camera's eye level → reads as infinitely far. */
export const LINE_LAYOUT: LineLayerSpec[] = [
  { layer: 'far', z: LAYER_Z.far, width: 230, anchorY: WORLD.focusY + 1.7, anchorV: 0.5, fog: false },
  { layer: 'mid', z: LAYER_Z.midFar, width: 96, anchorY: -9.5, anchorV: 0.0, fog: true },
  { layer: 'near', z: LAYER_Z.verge - 0.3, width: 22, anchorY: -0.15, anchorV: 0.0, fog: false },
];

/** Per-line tweaks (mid strips differ a lot in how much ground they paint). */
const MID_ANCHOR: Record<number, number> = { 1: -9.5, 2: -8.0, 3: -9.0 };

function mirrored(t: THREE.Texture): THREE.Texture {
  const m = t.clone();
  m.wrapS = THREE.RepeatWrapping;
  m.repeat.x = -1;
  m.offset.x = 1;
  return m;
}

export function hasLineArt(line: number): boolean {
  return hasFile(PATHS.scenery(line, 'far')) || hasFile(PATHS.scenery(line, 'mid'));
}

/** Builds the line's layers; tiles appear once each image has loaded (aspect known). */
export function buildLineArt(line: number, scene: THREE.Scene): { group: THREE.Group; layers: TileLayer[] } {
  const group = new THREE.Group();
  const layers: TileLayer[] = [];
  scene.add(group);
  for (const spec of LINE_LAYOUT) {
    const path = PATHS.scenery(line, spec.layer);
    if (!hasFile(path)) continue;
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      const h = (spec.width * img.naturalHeight) / img.naturalWidth;
      const anchorY = spec.layer === 'mid' ? (MID_ANCHOR[line] ?? spec.anchorY) : spec.anchorY;
      const l = new TileLayer({
        width: spec.width,
        height: h,
        y: anchorY - spec.anchorV * h,
        z: spec.z,
        textures: [tex, mirrored(tex)],
        fog: spec.fog,
        renderOrder: spec.layer === 'far' ? -8 : 0,
      });
      layers.push(l);
      group.add(l.group);
    };
    img.src = fileUrl(path, true);
  }
  return { group, layers };
}
