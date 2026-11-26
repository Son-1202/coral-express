import * as THREE from 'three';
import { PATHS, fileUrl, hasFile, sharedTexture } from '../../assets';
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
/** Name sign size and height above the platform (world units, render only). */
const SIGN = { w: 3.0, h: 0.57, y: 1.95 };

/** Render-only layout of each line's station art: lamp positions (fractions of the image, from top-left). */
const LAMPS: Record<number, { x: number; y: number }[]> = {
  1: [{ x: 0.585, y: 0.44 }],
  2: [{ x: 0.295, y: 0.53 }],
  3: [{ x: 0.5, y: 0.35 }],
};

/**
 * T-32: platform face/top cut from each Line's own station art (source pixels x0,y0,x1,y1 of
 * `station/l<n>.png`): L1 the sandstone plinth, L2/L3 the wooden deck planks. Tiled along the
 * 13-unit platform at the art's aspect (pixel art: nearest filtering). Render layout only.
 */
type Rect = readonly [number, number, number, number];
export const PLATFORM_CROP: Record<number, { face: Rect; top: Rect }> = {
  1: { face: [125, 173, 305, 201], top: [125, 172, 305, 185] },
  2: { face: [40, 300, 200, 318], top: [40, 300, 200, 318] },
  3: { face: [185, 178, 278, 193], top: [185, 178, 278, 193] },
};
const cropCache = new Map<number, { face: THREE.Texture; top: THREE.Texture }>();
const cropWaiters = new Map<number, ((t: { face: THREE.Texture; top: THREE.Texture }) => void)[]>();

function cropTex(img: HTMLImageElement, r: Rect, worldW: number, worldH: number): THREE.Texture {
  const [x0, y0, x1, y1] = r;
  const c = makeCanvas(x1 - x0, y1 - y0);
  c.ctx.drawImage(img, x0, y0, c.w, c.h, 0, 0, c.w, c.h);
  const t = toTexture(c, true);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = Math.max(1, Math.round(worldW / ((worldH * c.w) / c.h)));
  return t;
}

/** Calls `cb` with the Line's platform crop textures once its station art has loaded (shared by all platforms). */
function platformCrops(line: number, cb: (t: { face: THREE.Texture; top: THREE.Texture }) => void): void {
  const done = cropCache.get(line);
  if (done) return cb(done);
  const r = PLATFORM_CROP[line];
  const path = PATHS.station(line);
  if (!r || !hasFile(path)) return;
  const waiting = cropWaiters.get(line);
  if (waiting) {
    waiting.push(cb);
    return;
  }
  cropWaiters.set(line, [cb]);
  const img = new Image();
  img.onload = () => {
    const L = WORLD.platformLength;
    const t = { face: cropTex(img, r.face, L, PLATFORM_H), top: cropTex(img, r.top, L, 0.4) };
    cropCache.set(line, t);
    for (const w of cropWaiters.get(line) ?? []) w(t);
    cropWaiters.delete(line);
  };
  img.onerror = () => cropWaiters.delete(line);
  img.src = fileUrl(path);
}

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
  ctx.fillStyle = '#1f3238';
  let size = 30;
  ctx.font = `700 ${size}px "Pixelify Sans", sans-serif`;
  while (ctx.measureText(name).width > w - 24 && size > 12) {
    size -= 1;
    ctx.font = `700 ${size}px "Pixelify Sans", sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, w / 2, h / 2 + 1);
  return p.canvas;
}

/**
 * T-38: festival hang points per Line, as fractions of the uncropped station image (from top-left):
 * L1 the awning's two outer tips, L2 the two roof eaves, L3 the thatch's lower corners. Render layout only.
 */
const EAVES: Record<number, readonly [{ x: number; y: number }, { x: number; y: number }]> = {
  1: [{ x: 0.03, y: 0.3 }, { x: 0.965, y: 0.3 }],
  2: [{ x: 0.17, y: 0.4 }, { x: 0.97, y: 0.41 }],
  3: [{ x: 0.075, y: 0.28 }, { x: 0.78, y: 0.29 }],
};
/** Festival flag poles stand this far from the platform centre (world units). */
const FLAG_X = 6.2;

/** T-38: where festival decorations hang, local to a platform's origin (its world x = slot × spacing). */
export interface FestivalAnchors {
  /** Pole bases at both platform ends (on the platform top). */
  flagL: THREE.Vector3;
  flagR: THREE.Vector3;
  /** Left and right eave / awning tips, a hair in front of the building. */
  eaveL: THREE.Vector3;
  eaveR: THREE.Vector3;
  /** Top-left corner of the name sign, just behind it (bunting tucks in, never covers the name). */
  sign: THREE.Vector3;
}

const VIEWS: StationView[] = [];

/**
 * Festival anchors for the current Line (all platforms share one Line, so any sized view answers).
 * Null until a platform has been laid out once.
 */
export function festivalAnchors(): FestivalAnchors | null {
  for (const v of VIEWS) {
    const a = v.festivalAnchors();
    if (a) return a;
  }
  return null;
}

/** One platform: procedural platform, line station art, name sign, lamp glows. */
export class StationView {
  readonly group = new THREE.Group();
  private readonly building: THREE.Mesh;
  private readonly buildingMat: THREE.MeshBasicMaterial;
  private readonly sign: THREE.Mesh;
  private readonly signTex: THREE.CanvasTexture;
  private readonly glows: THREE.Mesh[] = [];
  /** Procedural platform (fallback until/unless the Line's station art crop is available). */
  private static procFace: THREE.Texture | null = null;
  private static procTop: THREE.Texture | null = null;
  private readonly faceMat = new THREE.MeshBasicMaterial({ map: (StationView.procFace ??= toTexture(paintPlatformFace(), true)) });
  private readonly topMat = new THREE.MeshBasicMaterial({ map: (StationView.procTop ??= toTexture(paintPlatformTop(), true)) });
  private line = 0;
  private name = '';
  /** Odometer slot this platform currently represents. */
  slot = Number.NaN;
  /** T-38: last layout (art or placeholder), for the festival anchors. */
  private laid: { isArt: boolean; fullH: number } | null = null;

  constructor(private readonly seed: number) {
    VIEWS.push(this);
    const L = WORLD.platformLength;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(L, PLATFORM_H), this.faceMat);
    face.position.set(0, PLATFORM_H / 2 - 0.02, -0.72);
    const topGeo = new THREE.PlaneGeometry(L, 1.4);
    topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, this.topMat);
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
    // QA bug 8: larger, fog-free and low enough to sit near the tilt-shift focus band
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w, SIGN.h), new THREE.MeshBasicMaterial({ map: this.signTex, transparent: true, fog: false }));
    this.sign.position.y = SIGN.y;
    const postMat = new THREE.MeshBasicMaterial({ color: '#4b3a2c' });
    for (const px of [-SIGN.w * 0.4, SIGN.w * 0.4]) {
      const post = new THREE.Mesh(new THREE.PlaneGeometry(0.09, SIGN.y), postMat);
      post.position.set(px, SIGN.y / 2, -0.01);
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
    this.faceMat.map = StationView.procFace;
    this.topMat.map = StationView.procTop;
    platformCrops(line, (t) => {
      if (this.line !== line) return;
      this.faceMat.map = t.face;
      this.topMat.map = t.top;
    });
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

  /** T-38: festival hang points (see `festivalAnchors`), null before the first layout. */
  festivalAnchors(): FestivalAnchors | null {
    const l = this.laid;
    if (!l) return null;
    const b = this.building;
    const w = b.scale.x;
    const top = b.position.y + b.scale.y / 2;
    const eaves = (l.isArt ? EAVES[this.line] : undefined) ?? [{ x: 0.05, y: 0.22 }, { x: 0.95, y: 0.22 }];
    const z = LAYER_Z.station + 0.04;
    const at = (e: { x: number; y: number }) => new THREE.Vector3(b.position.x + (e.x - 0.5) * w, top - e.y * l.fullH, z);
    const sx = 4.6 - SIGN.w / 2 + 0.12;
    return {
      flagL: new THREE.Vector3(-FLAG_X, PLATFORM_H - 0.02, -1.62),
      flagR: new THREE.Vector3(FLAG_X + 0.1, PLATFORM_H - 0.02, -1.62),
      eaveL: at(eaves[0]),
      eaveR: at(eaves[1]),
      sign: new THREE.Vector3(sx, PLATFORM_H + SIGN.y + SIGN.h / 2 - 0.06, -1.94),
    };
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
    this.laid = this.line > 0 ? { isArt, fullH: isArt ? ih / fit.px : h } : null;
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
