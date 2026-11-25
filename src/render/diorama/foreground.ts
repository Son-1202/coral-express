import * as THREE from 'three';
import { PATHS, fileUrl, hasFile } from '../../assets';
import { toTexture } from '../paint/canvas';
import { LAYER_Z, WORLD } from './config';
import { TileLayer } from './tileLayer';
import { foreStyle } from './foreStyle';
import { paintForeGrass, paintForeWall } from './paintFore';
import { paintNear, paintNearFront } from './paintNear';
import { paintNearFjord, paintNearVolcano } from './paintNearLines';
import { paintGrass, paintWall } from './paintTrack';

/**
 * Per-Line ground layers (QA bug 4): verge grass behind the track, embankment
 * wall, front garden, near strip and the blurred lens foliage. Line 1 keeps its
 * sunny picket-fence garden; Fjords and Volcano get their own materials, and
 * their lens foliage reuses the Line's painted `l<n>_near` strip.
 */
const LENS: Record<number, { width: number; y: number }> = {
  2: { width: 13, y: WORLD.nearGroundY - 0.45 },
  3: { width: 11, y: WORLD.nearGroundY - 0.85 },
};

export interface ForeSet {
  group: THREE.Group;
  layers: TileLayer[];
}

export function buildForeground(line: number): ForeSet {
  const group = new THREE.Group();
  const layers: TileLayer[] = [];
  const add = (o: ConstructorParameters<typeof TileLayer>[0]) => {
    const l = new TileLayer(o);
    layers.push(l);
    group.add(l.group);
  };
  const st = foreStyle(line);
  const l1 = line === 1;
  const s = line * 1000;
  const vergeDepth = WORLD.trackBackZ - WORLD.vergeBackZ;
  add({
    width: 24, height: vergeDepth + 0.2, y: WORLD.groundY - 0.01, z: (WORLD.trackBackZ + WORLD.vergeBackZ) / 2, horizontal: true,
    textures: [toTexture(l1 ? paintGrass(51, 24, 3, false) : paintForeGrass(st, s + 51, 24, 3, false))],
  });
  add({ width: 24, height: 1.0, y: WORLD.nearGroundY - 0.1, z: WORLD.trackFrontZ, textures: [toTexture(l1 ? paintWall(62) : paintForeWall(st, s + 62), true)] });
  add({
    width: 24, height: 8, y: WORLD.nearGroundY, z: WORLD.trackFrontZ + 4, horizontal: true,
    textures: [toTexture(l1 ? paintGrass(71, 24, 8, true) : paintForeGrass(st, s + 71, 24, 8, true))],
  });
  const near = line === 2 ? paintNearFjord : line === 3 ? paintNearVolcano : null;
  add({
    width: 16, height: 3, y: WORLD.nearGroundY, z: LAYER_Z.near,
    textures: [0, 1].map((v) => toTexture(near ? near(st, s + 72, v) : paintNear(72, v), true)),
  });
  const lens = LENS[line];
  const art = PATHS.scenery(line, 'near');
  if (lens && hasFile(art)) {
    // the Line's painted near strip, right in front of the lens (tilt-shift blurs it)
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
    add({ width: 14, height: 2, y: WORLD.nearGroundY - 0.2, z: LAYER_Z.nearFront, textures: [toTexture(paintNearFront(81)), toTexture(paintNearFront(82))] });
  }
  return { group, layers };
}
