import * as THREE from 'three';
import type { GameController, GameView } from '../game/controller';
import type { SimEvent } from '../sim';
import { nextStation } from '../sim/rates';
import stationsJson from '../story/stations.json';
import { Diorama } from './diorama/diorama';
import { CameraRig } from './diorama/cameraRig';
import { WORLD } from './diorama/config';
import { Train } from './train/train';
import { Post, FpsGuard, type Quality } from './post/post';
import { Particles } from './fx/particles';
import { BondFx } from './fx/bonds';
import { CoinFlight } from './fx/coins';
import { FrenzyRing } from './fx/frenzyRing';
import { Passengers } from './fx/passengers';
import { SightFx } from './fx/sights';
import { FxEvents } from './fx/fxEvents';
import { dayPhase, nightAmount } from './timeOfDay';
import { ODO_WRAP } from '../game/pose';
import { fishMaterial } from './train/fishMaterial';
import { fishSize, fishTexture } from './train/fishView';

export interface StageOpts {
  quality: Quality | 'auto';
}

interface StationEntry {
  id: string;
  name: string;
}
const STATION_NAMES = new Map<string, string>(
  (stationsJson as unknown as { stations: StationEntry[] }).stations.map((s) => [s.id, s.name]),
);

export type Pick =
  | { kind: 'sight' }
  | { kind: 'fish'; fishId: string; carId: string }
  | { kind: 'car'; carId: string }
  | null;

/**
 * The game view: renderer, diorama, sim-driven train, VFX and post stack.
 * Implements GameView (the controller calls `handle` for each sim event and `frame` per rAF).
 */
export class Stage implements GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly diorama = new Diorama();
  readonly rig: CameraRig;
  readonly train: Train;
  readonly post: Post;
  readonly guard: FpsGuard;
  readonly particles = new Particles();
  readonly bonds = new BondFx();
  readonly coins: CoinFlight;
  readonly passengers = new Passengers();
  readonly sights: SightFx;
  private readonly fx: FxEvents;
  readonly rings = new Map<string, FrenzyRing>();
  /** Car the camera follows (null = locomotive). */
  selectedCarId: string | null = null;
  time = 0;
  /** Pinned time of day (debug); null = 6-min cycle. */
  timeOverride: number | null = null;
  private lastX = Number.NaN;
  private lastVel = 0;
  private infoTimer = 0;
  private readonly slotNames = new Map<number, string>();
  private readonly ray = new THREE.Raycaster();
  private ghost: THREE.Mesh | null = null;
  quality: Quality | 'auto';
  /** Tank View covers the screen: skip the train-view render pass. */
  skipRender = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly game: GameController,
    o: StageOpts,
  ) {
    this.quality = o.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    const species = new Map(game.data.species.map((s) => [s.id, s.motion]));
    this.train = new Train((id) => species.get(id) ?? 'darter');
    const scene = this.diorama.scene;
    this.train.group.position.set(0, 0.2, 0.1);
    scene.add(this.train.group, this.train.steam.group, this.particles.group, this.passengers.group);
    this.coins = new CoinFlight(this.rig.camera, canvas);
    this.sights = new SightFx({
      focusX: () => this.rig.focusX,
      carRoof: (i) => {
        const car = this.train.cars[Math.min(i, this.train.cars.length - 1)];
        if (!car) return null;
        return { x: this.train.group.position.x + car.group.position.x, y: this.train.roofY };
      },
      nextStationX: () => (Math.floor(this.game.pose().odo) + 1) * WORLD.stationSpacing,
      zoomOut: (z) => this.rig.setZoom(z),
      fog: (m) => this.diorama.setFogMult(m),
      particles: this.particles,
    });
    scene.add(this.sights.group);
    this.fx = new FxEvents(this);
    this.diorama.nameForSlot = (slot) => this.slotNames.get(slot) ?? '';
    this.post = new Post(this.renderer, scene, this.rig.camera);
    if (o.quality !== 'auto') this.post.setQuality(o.quality);
    this.guard = new FpsGuard(() => {
      if (this.quality === 'auto') this.post.setQuality('low');
    });
    this.syncState();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.placeTrain(0);
    this.rig.snap(this.followX());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.rig.resize(w / h);
  }

  setQuality(q: Quality | 'auto'): void {
    this.quality = q;
    this.post.setQuality(q === 'auto' ? 'high' : q);
  }

  /** Index into train.centers of the followed part (0 = locomotive). */
  get followIndex(): number {
    if (!this.selectedCarId) return 0;
    const i = this.train.cars.findIndex((c) => c.id === this.selectedCarId);
    return i < 0 ? 0 : i + 1;
  }

  followX(): number {
    return this.train.group.position.x + (this.train.centers[this.followIndex] ?? 0);
  }

  stationName(line: number, k: number): string {
    return STATION_NAMES.get(`l${line}s${k}`) ?? `Station ${k}`;
  }

  /** Reconcile train + rings with the sim. */
  syncState(): void {
    const s = this.game.sim.state;
    this.train.sync(s);
    for (const car of this.train.cars) {
      if (!this.rings.has(car.id)) {
        const r = new FrenzyRing();
        // on the carriage door (front end, upper corner)
        r.mesh.position.set(this.train.carWidth / 2 - 0.2, 1.22, 0.12);
        car.group.add(r.mesh);
        this.rings.set(car.id, r);
      }
    }
    for (const id of [...this.rings.keys()]) {
      if (!this.train.car(id)) {
        this.rings.delete(id);
        this.bonds.drop(id);
      }
    }
    if (this.selectedCarId && !this.train.car(this.selectedCarId)) this.selectedCarId = null;
    this.diorama.setLine(s.currentLine);
  }

  private placeTrain(dt: number): void {
    const pose = this.game.pose();
    const x = pose.odo * WORLD.stationSpacing;
    // align the middle of the train with the platform centre when stopped
    const offset = this.train.length / 2 - 2.2;
    const wx = x + offset;
    if (Number.isFinite(this.lastX) && Math.abs(wx - this.lastX) > WORLD.stationSpacing * 1.5) {
      // big jump (offline / fast-forward / depot reset / odometer wrap): snap the view
      this.train.group.position.x = wx;
      this.rig.snap(this.followX());
      this.lastX = wx;
    }
    const vel = pose.vel * WORLD.stationSpacing;
    const accel = dt > 0 ? (vel - this.lastVel) / dt : 0;
    this.lastVel = vel;
    this.lastX = wx;
    this.train.group.position.x = wx;
    this.train.update(dt, this.time, vel, accel);
    // station names for the visible platforms
    const s = this.game.sim.state;
    const base = s.lifetime.arrivals % ODO_WRAP;
    const tr = s.train;
    this.slotNames.set(base, this.stationName(s.currentLine, tr.fromStation));
    this.slotNames.set(base + 1, this.stationName(s.currentLine, tr.phase === 'moving' ? tr.toStation : nextStation(s)));
    for (const k of this.slotNames.keys()) if (k < base - 3 || k > base + 1) this.slotNames.delete(k);
  }

  handle(e: SimEvent, bulk: boolean): void {
    if (bulk) return;
    this.fx.handle(e);
  }

  /** UI `itemFly`: sparkle + bubble pop where the bought item lands. */
  itemFly(carId: string): void {
    const at = this.train.carWorld(carId);
    if (!at) return;
    this.fx.itemLanded(at);
  }

  /** World X of a carriage's door (for passengers). */
  doorX(carId: string): number | null {
    const c = this.train.car(carId);
    return c ? this.train.group.position.x + c.group.position.x : null;
  }

  private refreshInfo(): void {
    const sim = this.game.sim;
    const cd = this.game.data.config.frenzy.cooldown;
    for (const car of this.train.cars) {
      let info;
      try {
        info = sim.carInfo(car.id);
      } catch {
        continue;
      }
      this.bonds.sync(car, info);
      car.frenzy = info.frenzyActive ? 1 : 0;
      const ring = this.rings.get(car.id);
      ring?.set(info.frenzyReadyIn > 0 ? 1 - info.frenzyReadyIn / cd : null, this.infoTimer);
    }
  }

  frame(dt: number, realDt = dt): void {
    this.guard.tick(realDt);
    this.time += dt;
    this.syncState();
    this.placeTrain(dt);
    this.infoTimer = dt;
    this.refreshInfo();
    this.bonds.update(dt, this.time, this.train.cars);
    this.fx.update(dt);
    this.particles.update(dt);
    this.passengers.update(dt, this.time);
    this.sights.update(dt, this.time);
    this.coins.update(dt);
    this.rig.update(dt, this.time, this.followX(), this.lastVel);
    const tod = this.timeOverride ?? dayPhase(this.game.sim.state.time);
    this.post.setTimeOfDay(tod);
    this.diorama.update(this.time, this.rig.camera, nightAmount(tod), dt);
    if (!this.skipRender) this.post.render(dt);
  }

  /** Raycast from normalised device coords. */
  pick(ndcX: number, ndcY: number): Pick {
    this.ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.rig.camera);
    if (this.sights.tappables.length && this.ray.intersectObjects(this.sights.tappables, false).length) return { kind: 'sight' };
    const fishMeshes: THREE.Object3D[] = [];
    for (const c of this.train.cars) for (const f of c.fish.values()) fishMeshes.push(f.mesh);
    const hf = this.ray.intersectObjects(fishMeshes, false)[0];
    if (hf) {
      const fishId = hf.object.userData.fishId as string;
      const found = this.train.findFish(fishId);
      if (found) return { kind: 'fish', fishId, carId: found.car.id };
    }
    const hc = this.ray.intersectObjects(this.train.cars.map((c) => c.hit), false)[0];
    if (hc) return { kind: 'car', carId: hc.object.userData.carId as string };
    return null;
  }

  /** Floating copy of a fish that follows the pointer while dragging (null hides it). */
  dragGhost(species: string | null, shiny: boolean, ndc: { x: number; y: number } | null): void {
    if (!species || !ndc) {
      if (this.ghost) {
        this.diorama.scene.remove(this.ghost);
        (this.ghost.material as THREE.Material).dispose();
        this.ghost = null;
      }
      return;
    }
    if (!this.ghost) {
      const tex = fishTexture(species, shiny);
      this.ghost = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fishMaterial(tex, 0));
      this.ghost.renderOrder = 20;
      this.diorama.scene.add(this.ghost);
    }
    this.ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.rig.camera);
    const p = new THREE.Vector3();
    this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.4), p);
    const m = this.ghost.material as THREE.ShaderMaterial;
    const sz = fishSize(m.uniforms.map?.value as THREE.Texture);
    this.ghost.position.copy(p);
    this.ghost.scale.set(sz.w * 1.3, sz.h * 1.3, 1);
    this.ghost.rotation.z = Math.sin(this.time * 12) * 0.12;
  }
}
