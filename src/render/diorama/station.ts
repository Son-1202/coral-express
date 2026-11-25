import * as THREE from 'three';
import { PATHS, hasFile, sharedTexture } from '../../assets';
import { makeCanvas, toTexture } from '../paint/canvas';
import { LIVERY } from '../paint/palette';
import { LAYER_Z, WORLD } from './config';
import { paintPlatformFace, paintPlatformTop, paintStationBuilding, STATION_BUILDING } from './paintStation';

/** Station art is drawn at this many pixels per world unit (chunkier than the train: it sits further back). */
const STATION_PX = 72;
/**
 * Per-line normalisation (render only): pixels per world unit, so the three
 * stations read at one scale next to the train (L2's house is painted larger),
 * and the fraction of the image cropped off the bottom (L3 has painted rails
 * under its deck that would read as a second track).
 */
export const STATION_FIT: Record<number, { px: number; cropBottom: number }> = {
  1: { px: STATION_PX, cropBottom: 0 },
  2: { px: 92, cropBottom: 0 },
  3: { px: 76, cropBottom: 0.25 },
};
const PLATFORM_H = 0.42;

/** Render-only layout of each line's station art: lamp positions (fractions of the image, from top-left). */
const LAMPS: Record<number, { x: number; y: number }[]> = {
  1: [{ x: 0.585, y: 0.44 }],
  2: [{ x: 0.295, y: 0.53 }],
  3: [{ x: 0.5, y: 0.35 }],
};

let glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const p = makeCanvas(64, 64);
  const g = p.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,236,180,1)');
  g.addColorStop(0.25, 'rgba(255,214,140,0.55)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  p.ctx.fillStyle = g;
  p.ctx.fillRect(0, 0, 64, 64);
  glowTex = toTexture(p);
  return glowTex;
}

/** Cream railway sign with a brass rim and the station name (Pixelify Sans). */
export function paintSign(name: string): HTMLCanvasElement {
  const p = makeCanvas(256, 48);
  const { ctx, w, h } = p;
  ctx.fillStyle = LIVERY.brassDark;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = LIVERY.brass;
  ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = LIVERY.cream;
  ctx.fillRect(5, 5, w - 10, h - 10);
  ctx.fillStyle = '#2f4a52';
  let size = 26;
  ctx.font = `600 ${size}px "Pixelify Sans", sans-serif`;
  while (ctx.measureText(name).width > w - 24 && size > 12) {
    size -= 1;
    ctx.font = `600 ${size}px "Pixelify Sans", sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, w / 2, h / 2 + 1);
  return p.canvas;
}

/** One platform: procedural platform, line station art, name sign, lamp glows. */
export class StationView {
  readonly group = new THREE.Group();
  private readonly building: THREE.Mesh;
  private readonly buildingMat: THREE.MeshBasicMaterial;
  private readonly sign: THREE.Mesh;
  private readonly signTex: THREE.CanvasTexture;
  private readonly glows: THREE.Mesh[] = [];
  private line = 0;
  private name = '';
  /** Odometer slot this platform currently represents. */
  slot = Number.NaN;

  constructor(private readonly seed: number) {
    const L = WORLD.platformLength;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(L, PLATFORM_H), new THREE.MeshBasicMaterial({ map: toTexture(paintPlatformFace(), true) }));
    face.position.set(0, PLATFORM_H / 2 - 0.02, -0.72);
    const topGeo = new THREE.PlaneGeometry(L, 1.4);
    topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, new THREE.MeshBasicMaterial({ map: toTexture(paintPlatformTop(), true) }));
    top.position.set(0, PLATFORM_H - 0.02, -1.42);
    // opaque pass + alpha cut-out: depth-tested behind the train, never sorted over it
    this.buildingMat = new THREE.MeshBasicMaterial({ transparent: false, alphaTest: 0.5 });
    this.building = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.buildingMat);
    this.building.renderOrder = -2;
    this.building.position.z = LAYER_Z.station;
    // sign on two posts, right of the building
    this.signTex = toTexture(paintSign(''));
    this.signTex.anisotropy = 8;
    const sign = new THREE.Group();
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.49), new THREE.MeshBasicMaterial({ map: this.signTex, transparent: true }));
    this.sign.position.y = 2.25;
    const postMat = new THREE.MeshBasicMaterial({ color: '#4b3a2c' });
    for (const px of [-1.05, 1.05]) {
      const post = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 2.1), postMat);
      post.position.set(px, 1.05, -0.01);
      sign.add(post);
    }
    sign.add(this.sign);
    sign.position.set(4.6, PLATFORM_H, -1.9);
    this.group.add(face, top, this.building, sign);
  }

  setLine(line: number): void {
    if (line === this.line) return;
    this.line = line;
    const path = PATHS.station(line);
    const art = hasFile(path);
    const tex = art
      ? sharedTexture(path, () => paintStationBuilding(90 + this.seed), { pixel: true })
      : sharedTexture(`proc:station:${this.seed}`, () => paintStationBuilding(90 + this.seed), { pixel: true });
    const crop = art ? (STATION_FIT[line]?.cropBottom ?? 0) : 0;
    // texture is shared by the 3 platforms: the crop is per line, so setting it here is idempotent
    tex.repeat.y = 1 - crop;
    tex.offset.y = crop;
    this.buildingMat.map = tex;
    this.buildingMat.needsUpdate = true;
    for (const g of this.glows) this.group.remove(g);
    this.glows.length = 0;
    const lamps = art ? (LAMPS[line] ?? []) : [{ x: 0.2, y: 0.4 }, { x: 0.8, y: 0.4 }];
    for (const _ of lamps) {
      const g = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.6),
        new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.2, 1.8, 1.2), opacity: 0 }),
      );
      g.renderOrder = 4;
      g.userData.lamp = _;
      this.glows.push(g);
      this.group.add(g);
    }
  }

  setName(name: string): void {
    if (name === this.name) return;
    this.name = name;
    this.signTex.image = paintSign(name);
    this.signTex.needsUpdate = true;
    this.sign.visible = name !== '';
  }

  /** Re-paint the sign (after the webfont arrives). */
  repaintSign(): void {
    const n = this.name;
    this.name = '';
    this.setName(n);
  }

  update(night: number): void {
    // size the building from its texture (pixel art, constant pixels per unit)
    const img = this.buildingMat.map?.image as { width?: number; height?: number } | undefined;
    const iw = img?.width ?? 1;
    const ih = img?.height ?? 1;
    const isArt = iw >= 200;
    const fit = STATION_FIT[this.line] ?? { px: STATION_PX, cropBottom: 0 };
    const w = isArt ? iw / fit.px : STATION_BUILDING.w;
    const h = isArt ? (ih * (1 - fit.cropBottom)) / fit.px : STATION_BUILDING.h;
    this.building.scale.set(w, h, 1);
    this.building.position.set(isArt ? -0.6 : 0, (isArt ? PLATFORM_H - 0.12 : PLATFORM_H - 0.05) + h / 2, LAYER_Z.station);
    for (const g of this.glows) {
      const l = g.userData.lamp as { x: number; y: number };
      // lamp y is a fraction of the uncropped image
      const ly = isArt ? l.y / (1 - fit.cropBottom) : l.y;
      g.position.set(this.building.position.x + (l.x - 0.5) * w, this.building.position.y + (0.5 - ly) * h, LAYER_Z.station + 0.05);
      (g.material as THREE.MeshBasicMaterial).opacity = night * 0.9;
      g.visible = night > 0.02;
    }
  }
}
