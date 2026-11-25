import * as THREE from 'three';
import type { SimState } from '../../sim';
import type { FarVariant } from '../../assets';
import { clamp01, smoothstep } from '../anim/ease';
import { Train, type CarView, type SpeciesMotion } from '../train/train';
import { DEPOT_PALETTE } from './paintDepot';
import { DepotOverlay } from './overlay';
import { BACKDROP_ORDER, DepotSet, SIDING_Z, TRAIN_Y, type SetLayout } from './depotSet';
import { PoolFish } from './poolFish';
import { depotArtSettled, disposeTree, preloadDepotArt } from './depotLoad';
import { sidingSlots } from './depotArt';

/** One carriage of the run that just ended (captured before the sim state is swapped). */
export interface DepotCar {
  id: string;
  habitat: string;
  fish: { id: string; species: string; shiny: boolean }[];
}

export interface DepotSnapshot {
  cars: DepotCar[];
  heritageId: string | null;
}

/** Beat times (s). Render-only choreography (SPEC B4.9). */
const T = { arrive: 2.2, uncouple: 2.3, perCar: 0.28, carRoll: 1.6, leave: 4.7, fadeOut: 6.4, end: 7.3 };
const CAR_GAP = 0.12;
const PRELOAD_DELAY_MS = 3000;
/** Set tint per far-scenery variant (render only). */
const SET_TINT: Record<FarVariant, string> = { day: '#ffffff', morning: '#fff3e4', dusk: '#f6d2ae', night: '#7f8fc4' };
/** Late art may still replace the painters until this scene time (the white fade-in). */
const REBUILD_BEFORE = 0.45;

/** Scene time-of-day phase (0 morning … 0.75 night, as timeOfDay.ts) → far-scenery variant. */
export function farVariant(tod: number | undefined): FarVariant {
  if (tod === undefined) return 'day';
  const p = ((tod % 1) + 1) % 1;
  if (p < 0.125 || p >= 0.92) return 'morning';
  if (p < 0.4) return 'day';
  if (p < 0.6) return 'dusk';
  return 'night';
}

interface Rolling {
  car: THREE.Group;
  view: CarView;
  /** World X last frame (own wheel spin). */
  lastWx: number;
  /** Train-local X when coupled. */
  x0: number;
  /** World X on the siding (against the buffer / the car before it). */
  xEnd: number;
  start: number;
  fishOut: boolean;
  layer: THREE.Object3D;
  fish: DepotCar['fish'];
}

/**
 * Depot Reset scene (~7 s, skippable): the train pulls into the engine shed's doorway, the
 * non-Heritage carriages uncouple and roll back onto the siding up to the buffer stop, their
 * fish hop into the depot pool and swim there, and the locomotive leaves with the Heritage
 * carriage only. Then `onDone(line)` (→ Stage.onRunStart).
 */
export class DepotScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 400);
  private train: Train | null = null;
  private readonly world = new THREE.Group();
  private readonly set = new DepotSet();
  private poolFish: PoolFish | null = null;
  private rolling: Rolling[] = [];
  private layout: SetLayout | null = null;
  private t = 0;
  private stopX = 0;
  private lastX = 0;
  private lastV = 0;
  private line = 1;
  private onDone: ((line: number) => void) | null = null;
  private overlay: DepotOverlay | null = null;
  private playId = 0;
  active = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly motionOf: SpeciesMotion,
  ) {
    this.scene.add(this.set.group, this.world);
    // T-35: fetch + analyse the depot art once the game is up (≈3.3 MB, off the boot path) so the
    // first reset already uses it
    setTimeout(() => void preloadDepotArt(), PRELOAD_DELAY_MS);
  }

  /** Seconds into the scene (debug / screenshots). */
  get time(): number {
    return this.t;
  }

  /** Debug / tests: world positions of the fish swimming in the pool, and the water rectangle. */
  get pool(): { fish: THREE.Vector3[]; water: SetLayout['water'] | null } {
    return { fish: this.poolFish?.positions() ?? [], water: this.layout?.water ?? null };
  }

  /** `tod`: day phase in [0,1) (timeOfDay.ts) — picks the Line's far-scenery variant. */
  play(snap: DepotSnapshot, line: number, onDone: (line: number) => void, tod?: number): void {
    this.stop();
    this.playId++;
    this.active = true;
    this.t = 0;
    this.line = line;
    this.onDone = onDone;
    const fish = this.build(snap, farVariant(tod));
    this.overlay = new DepotOverlay(this.host, () => this.skip(), this.rolling.length, fish);
    if (!depotArtSettled()) {
      // art still on its way (very early reset / slow network): swap it in while the white
      // fade-in still hides the set; later than that the painters stay for this scene
      const play = this.playId;
      void preloadDepotArt().then(() => {
        if (this.active && this.playId === play && this.t < REBUILD_BEFORE) this.rebuild(snap, farVariant(tod));
      });
    }
  }

  private rebuild(snap: DepotSnapshot, tod: FarVariant): void {
    this.poolFish?.dispose();
    this.poolFish = null;
    disposeTree(this.world);
    this.world.clear();
    this.set.clear();
    this.rolling = [];
    this.build(snap, tod);
    this.train?.update(0, this.t, 0, 0);
  }

  /** Jump to the fade-out. */
  skip(): void {
    if (this.active && this.t < T.fadeOut) this.t = T.fadeOut;
  }

  /** Seek (debug): advance the choreography to `sec`. */
  seek(sec: number): void {
    while (this.active && this.t < sec - 1e-6) this.update(Math.min(1 / 30, sec - this.t));
  }

  private stop(): void {
    this.poolFish?.dispose();
    this.poolFish = null;
    // the scene's own Train (its sprites / tanks / steam; shared art textures are kept)
    disposeTree(this.world);
    this.world.clear();
    this.set.clear();
    this.rolling = [];
    this.train = null;
    this.layout = null;
    this.overlay?.dispose();
    this.overlay = null;
  }

  private build(snap: DepotSnapshot, tod: FarVariant): number {
    const pal = DEPOT_PALETTE[this.line] ?? DEPOT_PALETTE[1]!;
    this.scene.background = new THREE.Color(pal.sky);
    // order: Heritage right behind the locomotive, then the rest of the run
    const her = snap.cars.find((c) => c.id === snap.heritageId);
    const cars = [...(her ? [her] : []), ...snap.cars.filter((c) => c !== her)];
    const train = new Train(this.motionOf);
    const fake = {
      carriages: cars.map((c) => ({ id: c.id, habitat: c.habitat, fish: c.fish.map((f) => f.id) })),
      fish: Object.fromEntries(cars.flatMap((c) => c.fish.map((f) => [f.id, { species: f.species, shiny: f.shiny, carId: c.id }]))),
    };
    // Train.sync only reads carriages[].{id,habitat,fish} and fish[id].{species,shiny,carId}
    train.sync(fake as unknown as SimState);
    this.train = train;
    const locoW = -(train.centers[0] ?? -1.54) * 2;
    const locoH = train.roofY - train.group.position.y;
    const rollingCars = cars.filter((c) => c.id !== snap.heritageId).length;
    const L = this.set.build({ line: this.line, tod, locoW, locoH, carW: train.carWidth, trainLen: train.length, rolling: rollingCars });
    this.layout = L;
    this.stopX = L.stopX;
    // T-24: wheels on the rail head (do not change)
    train.group.position.set(this.stopX - train.length - 22, TRAIN_Y, 0);
    this.lastX = train.group.position.x;
    this.world.add(train.group, train.steam.group);

    this.poolFish = new PoolFish(L.water, this.motionOf, L.fishOrder);
    this.world.add(this.poolFish.group);

    // rear-most carriage uncouples first so the rake peels away one by one; it ends against the buffer
    const order: number[] = [];
    for (let i = train.cars.length - 1; i >= 0; i--) if (cars[i] && cars[i]!.id !== snap.heritageId) order.push(i);
    const slots = sidingSlots(L.bufferFaceX, train.carWidth, CAR_GAP, order.length);
    let fish = 0;
    order.forEach((i, k) => {
      const cv = train.cars[i]!;
      const dc = cars[i]!;
      fish += dc.fish.length;
      this.rolling.push({ car: cv.group, view: cv, lastWx: Number.NaN, x0: cv.group.position.x, xEnd: slots[k]!, start: T.uncouple + k * T.perCar, fishOut: false, layer: cv.fishLayer, fish: dc.fish });
    });
    this.tint(tod);
    const f = L.frame;
    this.fit(f.x0, f.x1, f.y0, f.y1);
    this.set.settle(this.camera.position);
    return fish;
  }

  /**
   * The depot renders straight to the screen (no ride colour grade), so a dusk / night backdrop
   * would sit behind a day-lit set: tint every sprite of the set and the train to match.
   */
  private tint(tod: FarVariant): void {
    const c = new THREE.Color(SET_TINT[tod]);
    if (tod === 'day') return;
    const apply = (root: THREE.Object3D) =>
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.renderOrder === BACKDROP_ORDER) return;
        const m = o.material as THREE.Material;
        if (m instanceof THREE.MeshBasicMaterial) m.color.multiply(c);
      });
    apply(this.set.group);
    apply(this.world);
  }

  /** Frame the world box [x0,x1]×[y0,y1] (at z≈0), leaving room for the caption card on top. */
  private fit(x0: number, x1: number, y0: number, y1: number): void {
    const c = this.camera;
    const tanH = Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
    const cx = (x0 + x1) / 2;
    // caption card covers the top ~22 % of the screen: give the box the lower ~78 %
    const top = y1 + (y1 - y0) * 0.3;
    const halfW = (x1 - x0) / 2 + 0.4;
    const halfH = (top - y0) / 2 + 0.2;
    const d = Math.max(halfW / (tanH * c.aspect), halfH / tanH);
    const cy = (top + y0) / 2;
    c.position.set(cx, cy + d * 0.08, d);
    c.lookAt(cx, cy, 0);
    c.updateProjectionMatrix();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    if (!this.active || !this.train) return;
    this.t += dt;
    const t = this.t;
    const train = this.train;
    // 1. pull into the shed doorway and stop (ease out)
    const startX = this.stopX - train.length - 22;
    let x: number;
    if (t < T.arrive) x = startX + (this.stopX - startX) * (1 - Math.pow(1 - t / T.arrive, 3));
    else if (t < T.leave) x = this.stopX;
    else x = this.stopX + Math.pow(t - T.leave, 2) * 4.5;
    train.group.position.x = x;
    const v = dt > 0 ? (x - this.lastX) / dt : 0;
    const acc = dt > 0 ? (v - this.lastV) / dt : 0;
    this.lastX = x;
    this.lastV = v;
    // 2. uncoupled carriages roll back onto the siding up to the buffer (they stay when the loco leaves)
    for (const r of this.rolling) {
      const u = clamp01((t - r.start) / T.carRoll);
      // ease-in-out roll; the last 8 % is a little bump-and-settle against the car ahead / buffer
      const e = smoothstep(u);
      const worldX0 = this.stopX + r.x0;
      const settle = u > 0.92 ? Math.sin(((u - 0.92) / 0.08) * Math.PI) * 0.03 : 0;
      const wx = t < r.start ? x + r.x0 : worldX0 + (r.xEnd - worldX0) * e + settle;
      r.car.position.x = wx - x;
      const sw = smoothstep(clamp01(u * 1.6));
      r.car.position.z = sw * SIDING_Z;
      r.car.position.y = sw * (this.layout?.sidingDy ?? 0);
      if (!r.fishOut && t > r.start + 0.5) {
        r.fishOut = true;
        this.releaseFish(r);
      }
    }
    train.update(dt, t, Math.abs(v), acc);
    // uncoupled cars: wheels turn with their own roll (Train.update spun them with the loco) and
    // parked cars don't rock while the locomotive pulls away
    const dxTrain = v * dt;
    for (const r of this.rolling) {
      const wx = x + r.car.position.x;
      const dxCar = Number.isFinite(r.lastWx) ? wx - r.lastWx : dxTrain;
      r.lastWx = wx;
      if (t < r.start) continue;
      for (const w of r.view.wheels) w.mesh.rotation.z += (dxTrain - dxCar) / w.r;
      r.view.body.position.y = 0;
      r.view.body.rotation.z = 0;
    }
    // 3. fish hop into the pool and swim there
    this.poolFish?.update(dt, t);
    this.overlay?.update(t, T);
    if (t >= T.end) {
      const done = this.onDone;
      const line = this.line;
      this.active = false;
      this.stop();
      done?.(line);
    }
  }

  private releaseFish(r: Rolling): void {
    r.layer.visible = false;
    const from = new THREE.Vector3();
    r.layer.getWorldPosition(from);
    r.fish.forEach((f, i) => {
      this.poolFish?.add(f, from.clone().add(new THREE.Vector3((i % 3) * 0.4 - 0.4, 0, 0.2)), this.t + i * 0.12);
    });
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
