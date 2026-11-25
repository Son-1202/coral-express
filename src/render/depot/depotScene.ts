import * as THREE from 'three';
import type { SimState } from '../../sim';
import { makeCanvas, toTexture } from '../paint/canvas';
import { PATHS, hasFile, sharedTexture } from '../../assets';
import { clamp01, smoothstep } from '../anim/ease';
import { Train, type SpeciesMotion } from '../train/train';
import { fishSize, fishTexture } from '../train/fishView';
import { DEPOT_PALETTE, paintPillar, paintPool, paintRails, paintShedBack, paintShedRoof } from './paintDepot';
import { DepotOverlay } from './overlay';

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
const SIDING_Z = -2.6;

interface Rolling {
  car: THREE.Group;
  x0: number;
  start: number;
  fishOut: boolean;
  layer: THREE.Object3D;
  fish: DepotCar['fish'];
}

interface PoolFish {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t0: number;
  ph: number;
}

/**
 * Depot Reset scene (~7 s, skippable): the train pulls into an engine shed in the
 * Line's colours, the non-Heritage carriages uncouple and roll back onto a siding,
 * their fish hop into the depot pool to rest, and the locomotive leaves with the
 * Heritage carriage only. Then `onDone(line)` (→ Stage.onRunStart).
 */
export class DepotScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 400);
  private train: Train | null = null;
  private readonly world = new THREE.Group();
  private readonly pondFish = new THREE.Group();
  private rolling: Rolling[] = [];
  private pool: PoolFish[] = [];
  private t = 0;
  private stopX = 0;
  private lastX = 0;
  private lastV = 0;
  private line = 1;
  private onDone: ((line: number) => void) | null = null;
  private overlay: DepotOverlay | null = null;
  private poolAt = new THREE.Vector3();
  active = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly motionOf: SpeciesMotion,
  ) {
    this.scene.add(this.world, this.pondFish);
  }

  /** Seconds into the scene (debug / screenshots). */
  get time(): number {
    return this.t;
  }

  play(snap: DepotSnapshot, line: number, onDone: (line: number) => void): void {
    this.stop();
    this.active = true;
    this.t = 0;
    this.line = line;
    this.onDone = onDone;
    this.build(snap);
    this.overlay = new DepotOverlay(this.host, () => this.skip(), snap.cars.length - (snap.heritageId ? 1 : 0), this.pool.length);
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
    this.world.clear();
    this.pondFish.clear();
    this.rolling = [];
    this.pool = [];
    this.train = null;
    this.overlay?.dispose();
    this.overlay = null;
  }

  private build(snap: DepotSnapshot): void {
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
    const len = train.length;
    // the shed houses the locomotive + Heritage carriage; the rest of the rake sticks out to the left
    const front = (train.centers[0] ?? 0) - (train.centers[1] ?? -4.5);
    const shedW = Math.max(8.5, front * 2 + 4.5);
    const wallH = 3.4;
    this.stopX = shedW / 2 - 0.8;
    // T-24: rail head (row 2 of paintRails on the 0.34-tall strip at y 0.04) is at y ≈ 0.1675; art wheels end at
    // BODY_LIFT 0.05 above the group, so 0.11 rests them on the rail head (was 0.18: hovering ~0.06 above it).
    train.group.position.set(-len - 22, 0.11, 0);
    this.lastX = train.group.position.x;
    this.world.add(train.group, train.steam.group);

    // ground + tracks (main and siding)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 24), new THREE.MeshBasicMaterial({ color: pal.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 1.9 - 12);
    const bankCol = new THREE.Color(pal.ground).multiplyScalar(0.78);
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(400, 60), new THREE.MeshBasicMaterial({ color: bankCol }));
    bank.position.set(0, -30, 1.9);
    const railsTex = toTexture(paintRails(), true);
    railsTex.wrapS = THREE.RepeatWrapping;
    railsTex.repeat.x = 60;
    const main = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.34), new THREE.MeshBasicMaterial({ map: railsTex, transparent: true, alphaTest: 0.5 }) /* T-24: clear top rows were drawn black */);
    main.position.set(0, 0.04, 0.02);
    const siding = main.clone();
    siding.position.set(-200 - shedW / 2 + 2, 0.04, SIDING_Z);
    this.world.add(ground, bank, main, siding);

    // engine shed (cut-away): back wall, roof, front posts
    const back = new THREE.Mesh(new THREE.PlaneGeometry(shedW, wallH), new THREE.MeshBasicMaterial({ map: toTexture(paintShedBack(pal, Math.round(shedW * 34), 128), true) }));
    back.position.set(0, wallH / 2, -1.4);
    const roofH = 1.3;
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(shedW * 1.08, roofH), new THREE.MeshBasicMaterial({ map: toTexture(paintShedRoof(pal, Math.round(shedW * 36), 64), true), transparent: true, alphaTest: 0.5 }));
    roof.position.set(0, wallH + roofH / 2 - 0.25, -0.6);
    const pillarTex = toTexture(paintPillar(pal), true);
    for (const px of [-shedW / 2, shedW / 2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, wallH + 0.1), new THREE.MeshBasicMaterial({ map: pillarTex }));
      p.position.set(px, (wallH + 0.1) / 2, 0.9);
      this.world.add(p);
    }
    // the Line's painted horizon behind the yard
    const farPath = PATHS.scenery(this.line, 'far');
    if (hasFile(farPath)) {
      const tex = sharedTexture(farPath, () => makeCanvas(2, 2).canvas, { webp: true });
      const far = new THREE.Mesh(new THREE.PlaneGeometry(320, 144), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
      far.position.set(0, 8, -70);
      this.world.add(far);
    }
    this.world.add(back, roof);

    // depot pool (foreground, left of the shed)
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.9), new THREE.MeshBasicMaterial({ map: toTexture(paintPool(), true), transparent: true, alphaTest: 0.5 }));
    this.poolAt.set(-shedW / 2 - 4.5, 0.7, 2.3);
    pool.position.copy(this.poolAt);
    this.world.add(pool);

    // carriages that will roll to the siding
    // rear-most carriage uncouples first so the rake peels away one by one
    for (let i = train.cars.length - 1; i >= 0; i--) {
      const cv = train.cars[i];
      const dc = cars[i];
      if (!cv || !dc || dc.id === snap.heritageId) continue;
      this.rolling.push({ car: cv.group, x0: cv.group.position.x, start: T.uncouple + this.rolling.length * T.perCar, fishOut: false, layer: cv.fishLayer, fish: dc.fish });
    }
    // frame the stopped train + pool
    const minX = Math.min(this.stopX - len - 1, this.poolAt.x - 4);
    const maxX = this.stopX + 3;
    const cx = (minX + maxX) / 2;
    const halfW = Math.max(7, (maxX - minX) / 2 + 0.6);
    this.fit(cx, halfW);
  }

  private fit(cx: number, halfW: number): void {
    const c = this.camera;
    const tanH = Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
    const distW = halfW / (tanH * c.aspect);
    const distH = 3.2 / tanH;
    const d = Math.max(distW, distH);
    c.position.set(cx, 2.6 + d * 0.08, d);
    c.lookAt(cx, 2.3, 0);
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
    // 1. pull in and stop inside the shed (ease out)
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
    // 2. uncoupled carriages roll back onto the siding (they stay behind when the loco leaves)
    for (const r of this.rolling) {
      const u = clamp01((t - r.start) / T.carRoll);
      const e = smoothstep(u);
      const worldX0 = this.stopX + r.x0;
      // in train-local space: hold still until uncoupled, then roll left + switch to the siding
      const wx = t < r.start ? x + r.x0 : worldX0 - e * 3.2;
      r.car.position.x = wx - x;
      r.car.position.z = e * SIDING_Z;
      if (!r.fishOut && t > r.start + 0.5) {
        r.fishOut = true;
        this.releaseFish(r);
      }
    }
    train.update(dt, t, Math.abs(v), acc);
    // 3. fish hop into the pool and bob there
    for (const f of this.pool) {
      const u = clamp01((t - f.t0) / 0.9);
      const m = f.mesh;
      if (u < 1) {
        m.position.lerpVectors(f.from, f.to, smoothstep(u));
        m.position.y += Math.sin(u * Math.PI) * 2.2;
        m.rotation.z = (0.5 - u) * 2;
      } else {
        m.position.set(f.to.x + Math.sin(t * 0.9 + f.ph) * 0.25, f.to.y + Math.sin(t * 2.2 + f.ph) * 0.05, f.to.z);
        m.rotation.z = Math.sin(t * 1.6 + f.ph) * 0.12;
        m.scale.x = Math.abs(m.scale.x) * (Math.cos(t * 0.9 + f.ph) >= 0 ? 1 : -1);
      }
    }
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
      const tex = fishTexture(f.species, f.shiny);
      const sz = fishSize(tex);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4 }));
      const k = 1.15;
      mesh.scale.set(sz.w * k, sz.h * k, 1);
      const n = this.pool.length;
      const to = new THREE.Vector3(this.poolAt.x + (((n * 0.37) % 1) - 0.5) * 3.8, this.poolAt.y - 0.1 + (((n * 0.61) % 1) - 0.5) * 0.45, this.poolAt.z + 0.05 + n * 0.001);
      this.pool.push({ mesh, from: from.clone().add(new THREE.Vector3((i % 3) * 0.4 - 0.4, 0, 0.2)), to, t0: this.t + i * 0.12, ph: n * 1.7 });
      mesh.position.copy(from);
      this.pondFish.add(mesh);
    });
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
