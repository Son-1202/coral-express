import * as THREE from 'three';
import { PATHS, hasFile, type FarVariant } from '../../assets';
import { toTexture } from '../paint/canvas';
import { paintRailSide } from '../diorama/paintTrack';
import { DEPOT_PALETTE, paintPillar, paintPool, paintRails, paintShedBack, paintShedRoof } from './paintDepot';
import { depotArt, disposeTree, loadImage, loaded, texOf } from './depotLoad';
import type { WaterRect } from './poolFish';

/**
 * The Depot Reset set (T-35): Line backdrop, depot yard, main track + siding with a buffer stop,
 * the engine shed (art: full shed behind the train, doorway-punched copy in front of it) and the
 * depot pool. Every piece falls back to the T-19 painters when its art file is missing.
 * Layout numbers are render-only.
 */

/** T-24: rail head of the paintRails strip (0.34 tall at y 0.04) is y ≈ 0.1675; wheels rest at group y 0.11. */
export const RAIL_STRIP = { y: 0.04, h: 0.34 } as const;
export const TRAIN_Y = 0.11;
export const SIDING_Z = -2.6;
/** Render order of the backdrop (also how the time-of-day tint recognises it). */
export const BACKDROP_ORDER = -10;
/** Shed layers straddle the train (z 0) and the main rail (z 0.02). */
const SHED_BACK_Z = -0.35;
const SHED_FRONT_Z = 0.35;
/** Doorway opening height relative to the locomotive sprite height. */
const DOOR_OVER_LOCO = 1.32;
const POOL_W = 7.2;
const BUFFER_H = 0.95;
/** T-24 rail head of the main line (world Y). */
const RAIL_HEAD = 0.1675;
/**
 * yard.png layout (T-34): tile width in world units (crates ≈ loco scale), bottom edge Y, and the
 * siding's rail-head row as a fraction of the tile height from the bottom (lower half of the
 * painted sleeper band, rows ≈ 320–515 of 646).
 */
const YARD = { tileW: 6.3, bottom: -0.1, headV: 0.3 } as const;
/** Foreground strips (main-game scale: foreground.ts draws the wall 1.0 tall). */
const WALL_H = 1.0;
/** Measured (T-35 pixel scan): parked cars sat ~2 px above the thin side-on siding rail; sink them onto its head. */
const SIDING_SINK = 0.032;
const MEADOW_H = 3.6;
const MEADOW_TOP = -0.55;

function yardTileH(img: HTMLImageElement): number {
  return (YARD.tileW * img.naturalHeight) / img.naturalWidth;
}

export interface SetLayout {
  /** Train group X (= locomotive nose) when stopped. */
  stopX: number;
  /** Left face of the buffer stop on the siding (cars stack from here). */
  bufferFaceX: number;
  water: WaterRect;
  /** Frame box (world) the camera must show. */
  frame: { x0: number; x1: number; y0: number; y1: number };
  /** Shed left/right edge (world). */
  shed: { x0: number; x1: number; top: number };
  /** Render order the pool fish use (between the pool and its water overlay). */
  fishOrder: number;
  /** Lift of a siding car above the main line (world Y). */
  sidingDy: number;
}

export interface SetInput {
  line: number;
  tod: FarVariant;
  locoW: number;
  locoH: number;
  carW: number;
  /** Rake length (loco + all cars). */
  trainLen: number;
  /** Cars that roll to the siding. */
  rolling: number;
}

function plane(w: number, h: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function basic(map: THREE.Texture, extra: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.5, ...extra });
}

/** Repositions a mesh at `zFrom` onto `zTo` so it projects identically from `cam` (parallax-free pair). */
export function alignToCamera(mesh: THREE.Object3D, cam: THREE.Vector3, zTo: number): void {
  const k = (cam.z - zTo) / (cam.z - mesh.position.z);
  mesh.position.set(cam.x + (mesh.position.x - cam.x) * k, cam.y + (mesh.position.y - cam.y) * k, zTo);
  mesh.scale.multiplyScalar(k);
}

export class DepotSet {
  readonly group = new THREE.Group();
  /** Meshes to re-project behind their twin once the camera is placed. */
  private readonly pairs: { mesh: THREE.Object3D; z: number }[] = [];

  /** Detach and free everything the last build made. */
  clear(): void {
    disposeTree(this.group);
    this.group.clear();
  }

  build(inp: SetInput): SetLayout {
    this.clear();
    this.pairs.length = 0;
    const pal = DEPOT_PALETTE[inp.line] ?? DEPOT_PALETTE[1]!;
    const art = depotArt();
    const g = this.group;

    // ---- shed ------------------------------------------------------------------------------
    let stopX: number;
    let shed: SetLayout['shed'];
    if (art.shed) {
      const s = art.shed;
      const k = (inp.locoH * DOOR_OVER_LOCO) / s.door.h; // world units per shed pixel
      const iw = s.img.naturalWidth * k;
      const ih = s.img.naturalHeight * k;
      // doorway sill on the ballast (bottom row of the opening at the rail strip's base)
      const doorBottomPx = s.door.y + s.door.h;
      const y = RAIL_STRIP.y - 0.02 + (s.img.naturalHeight - doorBottomPx) * -k + ih / 2;
      // the locomotive stops with its front half behind the wall right of the doorway
      const doorRightPx = s.door.x + s.door.w;
      stopX = 0; // nose X decided below from the doorway's right edge
      const doorRightX = 0;
      const cx = doorRightX - (doorRightPx - s.img.naturalWidth / 2) * k;
      const back = plane(iw, ih, basic(texOf(s.img)));
      back.position.set(cx, y, SHED_FRONT_Z);
      back.renderOrder = -2;
      this.pairs.push({ mesh: back, z: SHED_BACK_Z });
      const front = plane(iw, ih, basic(texOf(s.front)));
      front.position.set(cx, y, SHED_FRONT_Z);
      front.renderOrder = 6;
      g.add(back, front);
      stopX = doorRightX + inp.locoW * 0.5;
      shed = { x0: cx + (s.box.x - s.img.naturalWidth / 2) * k, x1: cx + (s.box.x + s.box.w - s.img.naturalWidth / 2) * k, top: y + ih / 2 - s.box.y * k };
    } else {
      const shedW = Math.max(8.5, inp.locoW * 2 + 4.5);
      const wallH = 3.4;
      stopX = shedW / 2 - 0.8;
      const back = plane(shedW, wallH, new THREE.MeshBasicMaterial({ map: toTexture(paintShedBack(pal, Math.round(shedW * 34), 128), true) }));
      back.position.set(0, wallH / 2, -1.4);
      const roofH = 1.3;
      const roof = plane(shedW * 1.08, roofH, basic(toTexture(paintShedRoof(pal, Math.round(shedW * 36), 64), true)));
      roof.position.set(0, wallH + roofH / 2 - 0.25, -0.6);
      const pillarTex = toTexture(paintPillar(pal), true);
      for (const px of [-shedW / 2, shedW / 2]) {
        const p = plane(0.3, wallH + 0.1, new THREE.MeshBasicMaterial({ map: pillarTex }));
        p.position.set(px, (wallH + 0.1) / 2, 0.9);
        g.add(p);
      }
      g.add(back, roof);
      shed = { x0: -shedW / 2, x1: shedW / 2, top: wallH + roofH };
    }

    // ---- yard + siding + buffer --------------------------------------------------------------
    // With the yard art the siding runs along its painted sleeper band (behind the main track,
    // a little higher on screen); without it, it is a plain second track at rail height.
    const sidingHead = art.yard ? YARD.bottom + YARD.headV * yardTileH(art.yard) : RAIL_HEAD;
    // the rake stops with its tail at stopX - trainLen; uncoupled cars roll ~2.4 further left
    const tailX = stopX - inp.trainLen;
    const bufferFaceX = tailX - 2.4;
    const bufW = 0.9;
    if (art.buffer) {
      const b = art.buffer;
      const k = BUFFER_H / b.box.h;
      const iw = b.img.naturalWidth * k;
      const ih = b.img.naturalHeight * k;
      const m = plane(iw, ih, basic(texOf(b.img)));
      // the art's bumpers face left: mirror it so they face the cars rolling in from the right
      m.scale.x = -1;
      const right = (b.img.naturalWidth / 2 - b.box.x) * k;
      const bottom = (b.img.naturalHeight / 2 - (b.box.y + b.box.h)) * k;
      m.position.set(bufferFaceX - right, sidingHead - 0.05 - bottom, SIDING_Z + 0.05);
      g.add(m);
    } else {
      const beam = plane(0.22, 0.6, new THREE.MeshBasicMaterial({ color: '#6b4a2e' }));
      beam.position.set(bufferFaceX - 0.11, sidingHead + 0.28, SIDING_Z + 0.05);
      const pad = plane(0.12, 0.26, new THREE.MeshBasicMaterial({ color: '#c8402f' }));
      pad.position.set(bufferFaceX - 0.03, sidingHead + 0.33, SIDING_Z + 0.06);
      g.add(beam, pad);
    }

    const railsTex = toTexture(paintRails(), true);
    railsTex.wrapS = THREE.RepeatWrapping;
    railsTex.repeat.x = 60;
    // T-24: clear top rows were drawn black → alphaTest
    const main = plane(400, RAIL_STRIP.h, new THREE.MeshBasicMaterial({ map: railsTex, transparent: true, alphaTest: 0.5 }));
    main.position.set(0, RAIL_STRIP.y, 0.02);
    const sidingLen = shed.x0 + 1 - (bufferFaceX - bufW);
    let siding: THREE.Mesh;
    if (art.yard) {
      // side-on rail (head = top row) standing on the yard's sleepers, same language as the main line
      const rt = toTexture(paintRailSide(), true);
      rt.wrapS = THREE.RepeatWrapping;
      rt.repeat.x = sidingLen / 24;
      siding = plane(sidingLen, 0.25, new THREE.MeshBasicMaterial({ map: rt, transparent: true, alphaTest: 0.5 }));
      siding.position.set(bufferFaceX - bufW + sidingLen / 2, sidingHead - 0.125, SIDING_Z);
    } else {
      const sTex = railsTex.clone();
      sTex.repeat.x = sidingLen / (400 / 60);
      siding = plane(sidingLen, RAIL_STRIP.h, new THREE.MeshBasicMaterial({ map: sTex, transparent: true, alphaTest: 0.5 }));
      siding.position.set(bufferFaceX - bufW + sidingLen / 2, RAIL_STRIP.y, SIDING_Z);
    }
    g.add(main, siding);
    this.ground(inp.line, pal.ground, art.yard);

    // ---- pool (foreground, left of the shed, below the track) --------------------------------
    const poolCx = Math.min(shed.x0 - POOL_W / 2 - 0.4, (bufferFaceX + shed.x0) / 2);
    const poolZ = 2.6;
    let water: WaterRect;
    let poolTop: number;
    let poolBottom: number;
    if (art.pool) {
      const p = art.pool;
      const k = POOL_W / p.img.naturalWidth;
      const ih = p.img.naturalHeight * k;
      // top of the pool art just below the rail line
      const cy = -0.25 - ih / 2 + (p.water.y > 0 ? 0 : 0);
      const back = plane(POOL_W, ih, basic(texOf(p.img)));
      back.position.set(poolCx, cy, poolZ);
      back.renderOrder = 1;
      const front = plane(POOL_W, ih, new THREE.MeshBasicMaterial({ map: texOf(p.front), transparent: true, depthWrite: false }));
      front.position.set(poolCx, cy, poolZ + 0.1);
      front.renderOrder = 4;
      g.add(back, front);
      const px = (x: number) => poolCx + (x - p.img.naturalWidth / 2) * k;
      const py = (y: number) => cy + (p.img.naturalHeight / 2 - y) * k;
      water = { cx: px(p.inner.x + p.inner.w / 2), cy: py(p.inner.y + p.inner.h / 2), w: p.inner.w * k, h: p.inner.h * k, z: poolZ + 0.05 };
      poolTop = cy + ih / 2;
      poolBottom = cy - ih / 2;
    } else {
      const ph = 1.9;
      const cy = -0.3 - ph / 2;
      const pool = plane(6, ph, basic(toTexture(paintPool(), true)));
      pool.position.set(poolCx, cy, poolZ);
      pool.renderOrder = 1;
      // see-through water over the fish (the painter's inner ellipse ≈ 0.86 × 0.62 of the strip)
      const over = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#3f9fa8', transparent: true, opacity: 0.35, depthWrite: false }));
      over.scale.set(6 * 0.43, ph * 0.31, 1);
      over.position.set(poolCx, cy - 0.05, poolZ + 0.1);
      over.renderOrder = 4;
      g.add(pool, over);
      water = { cx: poolCx, cy: cy - 0.03, w: 6 * 0.62, h: ph * 0.36, z: poolZ + 0.05 };
      poolTop = cy + ph / 2;
      poolBottom = cy - ph / 2;
    }

    // ---- backdrop -----------------------------------------------------------------------------
    this.backdrop(inp.line, inp.tod, pal.sky);

    const x0 = Math.min(bufferFaceX - bufW - 0.6, poolCx - POOL_W / 2 - 0.3);
    const x1 = Math.max(shed.x1 + 0.4, stopX + 1.2);
    void poolTop;
    return { stopX, bufferFaceX, water, frame: { x0, x1, y0: poolBottom - 0.45, y1: shed.top + 0.25 }, shed, fishOrder: 3, sidingDy: sidingHead - RAIL_HEAD - (art.yard ? SIDING_SINK : 0) };
  }

  /** Called once the camera is placed: tuck the shed's back copy behind the train without parallax. */
  settle(cam: THREE.Vector3): void {
    for (const p of this.pairs) alignToCamera(p.mesh, cam, p.z);
  }

  private ground(line: number, color: string, yard: HTMLImageElement | null): void {
    const g = this.group;
    // horizontal ground behind the tracks, vertical bank below the main track
    const ground = plane(400, 30, new THREE.MeshBasicMaterial({ color: yard ? '#6f665c' : color }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 1.9 - 15);
    const bankMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.78) });
    const bank = plane(400, 60, bankMat);
    bank.position.set(0, -30, 1.9);
    g.add(ground, bank);
    // the Line's own retaining wall (T-31) under the main track and its fenced meadow in front,
    // at the main game's scale (wall 1.0 tall) — the pool sits on that meadow
    this.foreStrip(PATHS.fore(line, 'wall'), WALL_H, 0.06, 1.92, false);
    this.foreStrip(PATHS.fore(line, 'ground'), MEADOW_H, MEADOW_TOP, 2.2, true);
    if (!yard) return;
    // T-34 yard strip: crates / drums on the far edge, gravel + the siding's sleepers below,
    // standing just behind the siding (tiled with mirrored repeats).
    const tileH = yardTileH(yard);
    const tex = texOf(yard, false);
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.repeat.x = 400 / YARD.tileW;
    const back = plane(400, tileH, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
    back.position.set(0, YARD.bottom + tileH / 2, SIDING_Z - 0.6);
    back.renderOrder = -5;
    g.add(back);
  }

  /** A tiled (mirrored) per-Line foreground strip of height `h` with its top edge at `top`. */
  private foreStrip(path: string, h: number, top: number, z: number, keyed: boolean): void {
    if (!hasFile(path)) return;
    const mat = new THREE.MeshBasicMaterial({ visible: false, transparent: keyed, alphaTest: keyed ? 0.5 : 0 });
    const m = plane(400, h, mat);
    m.position.set(0, top - h / 2, z);
    const place = (img: HTMLImageElement | null) => {
      if (!img) return;
      const tileW = (h * img.naturalWidth) / img.naturalHeight;
      const tex = texOf(img, false);
      tex.wrapS = THREE.MirroredRepeatWrapping;
      tex.repeat.x = 400 / tileW;
      mat.map = tex;
      mat.visible = true;
      mat.needsUpdate = true;
    };
    const ready = loaded(path, true);
    if (ready) place(ready);
    else void loadImage(path, true).then((img) => m.parent && place(img));
    this.group.add(m);
  }

  private backdrop(line: number, tod: FarVariant, sky: string): void {
    const own = PATHS.depotBackdrop(line);
    const far = PATHS.sceneryFar(line, tod);
    const path = hasFile(own) ? own : hasFile(far) ? far : PATHS.scenery(line, 'far');
    const webp = path !== own;
    const mat = new THREE.MeshBasicMaterial({ color: sky, fog: false });
    const m = plane(1, 1, mat);
    m.renderOrder = BACKDROP_ORDER;
    const place = (img: HTMLImageElement | null) => {
      const W = 320;
      const H = img ? (W * img.naturalHeight) / img.naturalWidth : 144;
      m.scale.set(W, H, 1);
      // horizon (≈ middle of the painting) a little above the shed roof line
      m.position.set(0, 8, -70);
      if (img) {
        mat.map = texOf(img, false);
        mat.color.set('#ffffff');
        mat.needsUpdate = true;
      }
    };
    const ready = loaded(path, webp);
    place(ready);
    if (!ready && hasFile(path)) void loadImage(path, webp).then((img) => m.parent && place(img));
    this.group.add(m);
  }
}
