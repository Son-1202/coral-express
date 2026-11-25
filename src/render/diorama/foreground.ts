import * as THREE from 'three';
import { PATHS, fileUrl, hasFile, type ForeKind } from '../../assets';
import { toTexture } from '../paint/canvas';
import { LAYER_Z, WORLD } from './config';
import { TileLayer } from './tileLayer';
import { foreStyle } from './foreStyle';
import { paintForeGrass, paintForeWall } from './paintFore';
import { paintNear, paintNearFront } from './paintNear';
import { paintNearFjord, paintNearVolcano } from './paintNearLines';
import { paintGrass, paintWall } from './paintTrack';
import { cropBand, loadArt, repeatX } from './artTex';
import { anchorBottom, fitRepeat } from './foreFit';
import { SpriteSlots } from './foreSprites';

/**
 * Per-Line ground band in front of / around the track (T-32): verge grass behind
 * the track, the retaining wall, the fenced meadow, a planter now and then and the
 * blurred lens foliage. Each element uses the Line's painted T-31 art
 * (`scenery/l<n>_{wall,ground,lens_1..3,planter}`) and falls back to the old
 * procedural painter only when that file is missing or fails to load.
 * Layout numbers below are render-only (no balance).
 */
const STRIP_W = 24;
/** Fence (top of the art) to fence base, in world units, per Line. */
const FENCE_H: Record<number, number> = { 1: 0.6, 2: 0.66, 3: 0.6 };
/**
 * Row (fraction of the image height from the top) where the ground art turns into
 * solid meadow — the fence base. Measured from the T-31 alpha (rows with ≥ 98.5 %
 * opaque columns all the way down).
 */
const FENCE_BASE: Record<number, number> = { 1: 0.285, 2: 0.304, 3: 0.277 };
/** The meadow band (from the bottom of the ground art) reused for flat grass and the skirt. */
const MEADOW_V = 0.5;
/** How far below the ground art the meadow skirt reaches (camera pull-back on narrow screens / Whale zoom). */
const SKIRT_H = 10;
const LENS = { slot: 4.2, chance: 0.8, zMin: 7.2, zMax: 7.8, jitter: 0.12, salt: 71, height: 2.25, baseY: -1.7 };
const PLANTER = { slot: 9, chance: 0.55, zMin: 4.05, zMax: 4.4, jitter: 0.1, salt: 83, height: 0.8, baseY: -1.12 };
const LENS_KINDS: ForeKind[] = ['lens_1', 'lens_2', 'lens_3'];

/** Old (pre-T-31) lens fallback for L2/L3: the Line's painted near strip. */
const NEAR_LENS: Record<number, { width: number; y: number }> = {
  2: { width: 13, y: WORLD.nearGroundY - 0.45 },
  3: { width: 11, y: WORLD.nearGroundY - 0.85 },
};

export interface ForeSet {
  group: THREE.Group;
  update(camera: THREE.PerspectiveCamera): void;
}

/** Half the visible width at depth `z` (world units). */
function halfAt(camera: THREE.PerspectiveCamera, z: number): number {
  return Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(1, camera.position.z - z) * camera.aspect;
}

export function buildForeground(line: number): ForeSet {
  const group = new THREE.Group();
  const layers: TileLayer[] = [];
  const sprites: { slots: SpriteSlots; z: number }[] = [];
  const add = (o: ConstructorParameters<typeof TileLayer>[0]) => {
    const l = new TileLayer(o);
    layers.push(l);
    group.add(l.group);
    return l;
  };
  const st = foreStyle(line);
  const l1 = line === 1;
  const s = line * 1000;
  const vergeDepth = WORLD.trackBackZ - WORLD.vergeBackZ;
  const verge = { width: STRIP_W, height: vergeDepth + 0.2, y: WORLD.groundY - 0.01, z: (WORLD.trackBackZ + WORLD.vergeBackZ) / 2, horizontal: true };
  const wall = { width: STRIP_W, height: 1.0, y: WORLD.nearGroundY - 0.1, z: WORLD.trackFrontZ };

  // retaining wall below the track
  loadArt(
    PATHS.fore(line, 'wall'),
    (img, tex) => add({ ...wall, textures: [repeatX(tex, fitRepeat(STRIP_W, img.naturalWidth, img.naturalHeight, wall.height).repeat)] }),
    () => add({ ...wall, textures: [toTexture(l1 ? paintWall(62) : paintForeWall(st, s + 62), true)] }),
    { maxW: 1280 },
  );

  // fenced meadow (fence + flowers + grass), verge grass behind the track, flat grass strip, skirt
  loadArt(
    PATHS.fore(line, 'ground'),
    (img, tex) => {
      const fenceBase = FENCE_BASE[line] ?? 0.3;
      const fit = fitRepeat(STRIP_W, img.naturalWidth, img.naturalHeight, (FENCE_H[line] ?? 0.6) / fenceBase);
      const z = LAYER_Z.near;
      const bottom = anchorBottom(fit.tileH, fenceBase, WORLD.nearGroundY);
      add({ width: STRIP_W, height: fit.tileH, y: bottom, z, textures: [repeatX(tex, fit.repeat)] });
      // flat meadow from the wall foot to the fence (seen through the fence gaps) and behind the track
      const flat = () => repeatX(tex.clone(), fit.repeat, 0, MEADOW_V);
      add({ width: STRIP_W, height: z - WORLD.trackFrontZ, y: WORLD.nearGroundY, z: (z + WORLD.trackFrontZ) / 2, horizontal: true, textures: [flat()] });
      add({ ...verge, textures: [flat()] });
      // skirt: the meadow band repeated (mirrored vertically) below the art, for pulled-back cameras
      const band = cropBand(img, 1 - MEADOW_V);
      const skirt = new THREE.CanvasTexture(band);
      skirt.colorSpace = THREE.SRGBColorSpace;
      skirt.wrapS = THREE.RepeatWrapping;
      skirt.wrapT = THREE.MirroredRepeatWrapping;
      const bandH = (fit.tileW * band.height) / band.width;
      // mirrored in V: the skirt's top edge must be an even V so it starts on the art's bottom row
      const rv = SKIRT_H / bandH;
      skirt.repeat.set(fit.repeat, rv);
      skirt.offset.set(0, 2 * Math.ceil(rv / 2) - rv);
      add({ width: STRIP_W, height: SKIRT_H, y: bottom - SKIRT_H + 0.01, z, textures: [skirt] });
    },
    () => {
      add({ ...verge, textures: [toTexture(l1 ? paintGrass(51, 24, 3, false) : paintForeGrass(st, s + 51, 24, 3, false))] });
      add({
        width: STRIP_W, height: 8, y: WORLD.nearGroundY, z: WORLD.trackFrontZ + 4, horizontal: true,
        textures: [toTexture(l1 ? paintGrass(71, 24, 8, true) : paintForeGrass(st, s + 71, 24, 8, true))],
      });
      const near = line === 2 ? paintNearFjord : line === 3 ? paintNearVolcano : null;
      add({
        width: 16, height: 3, y: WORLD.nearGroundY, z: LAYER_Z.near,
        textures: [0, 1].map((v) => toTexture(near ? near(st, s + 72, v) : paintNear(72, v), true)),
      });
    },
    { maxW: 1600 },
  );

  // a planter in front of the fence now and then
  if (hasFile(PATHS.fore(line, 'planter'))) {
    const planter = new SpriteSlots({ ...PLANTER, line, count: 1, soft: false });
    sprites.push({ slots: planter, z: PLANTER.zMin });
    group.add(planter.group);
    loadArt(PATHS.fore(line, 'planter'), (img, tex) => planter.addKind(0, tex, img.naturalWidth / img.naturalHeight), () => {}, { maxW: 384 });
  }

  // out-of-focus lens foliage right in front of the camera
  if (LENS_KINDS.some((k) => hasFile(PATHS.fore(line, k)))) {
    const lens = new SpriteSlots({ ...LENS, line, count: LENS_KINDS.length, soft: true, renderOrder: 3 });
    sprites.push({ slots: lens, z: LENS.zMin });
    group.add(lens.group);
    LENS_KINDS.forEach((k, i) => loadArt(PATHS.fore(line, k), (img, tex) => lens.addKind(i, tex, img.naturalWidth / img.naturalHeight), () => {}, { maxW: 768 }));
  } else {
    addOldLens(line, group, layers);
  }

  return {
    group,
    update(camera) {
      const cx = camera.position.x;
      for (const l of layers) l.update(cx);
      for (const sp of sprites) sp.slots.update(cx, halfAt(camera, sp.z));
    },
  };
}

/** Pre-T-31 lens layer: the Line's near strip (L2/L3) or the procedural bushes (L1). */
function addOldLens(line: number, group: THREE.Group, layers: TileLayer[]): void {
  const lens = NEAR_LENS[line];
  const art = PATHS.scenery(line, 'near');
  if (lens && hasFile(art)) {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      const flip = tex.clone();
      flip.wrapS = THREE.RepeatWrapping;
      flip.repeat.x = -1;
      flip.offset.x = 1;
      const h = (lens.width * img.naturalHeight) / img.naturalWidth;
      const l = new TileLayer({ width: lens.width, height: h, y: lens.y, z: LAYER_Z.nearFront, textures: [tex, flip], fog: false });
      layers.push(l);
      group.add(l.group);
    };
    img.src = fileUrl(art, true);
  } else {
    const l = new TileLayer({ width: 14, height: 2, y: WORLD.nearGroundY - 0.2, z: LAYER_Z.nearFront, textures: [toTexture(paintNearFront(81)), toTexture(paintNearFront(82))] });
    layers.push(l);
    group.add(l.group);
  }
}
