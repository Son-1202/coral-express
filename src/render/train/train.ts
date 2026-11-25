import * as THREE from 'three';
import type { MotionProfile } from '../../data/schema';
import type { SimState } from '../../sim';
import { hasAsset, loadTexture } from '../../assets';
import { toTexture } from '../paint/canvas';
import { CAR, LOCO, TANK_WINDOW, paintCarriage, paintLocomotive, paintWheel } from './paintTrain';
import { createTank, type Tank } from './tank';
import { Steam } from './steam';
import { FishView } from './fishView';

const GAP = 0.12;
const BODY_LIFT = 0.05;
/** World units per pixel of the real train art (car_shell 288 px, locomotive 320 px). */
const ART_PX = 1 / 104;

interface Geom {
  w: number;
  h: number;
  /** Window from the bottom-left of the sprite. */
  win: { x: number; y: number; w: number; h: number };
}

/** Real art: the glass cut-out of car_shell.png is x 24..263, y 27..99 (288×148). */
const CAR_ART: Geom = { w: 288 * ART_PX, h: 148 * ART_PX, win: { x: 24 * ART_PX, y: 48 * ART_PX, w: 240 * ART_PX, h: 73 * ART_PX } };
const CAR_PH: Geom = { w: CAR.w, h: CAR.h, win: TANK_WINDOW };
const LOCO_ART = { w: 320 * ART_PX, h: 151 * ART_PX };

interface Wheel {
  mesh: THREE.Mesh;
  r: number;
}

/** One carriage: frame sprite, tank shader, fish sprites, hit area. */
export interface CarView {
  id: string;
  index: number;
  group: THREE.Group;
  body: THREE.Group;
  /** Fish live here (origin = window centre). */
  fishLayer: THREE.Group;
  tank: Tank;
  fish: Map<string, FishView>;
  wheels: Wheel[];
  /** Invisible plane used for picking. */
  hit: THREE.Mesh;
  phase: number;
  habitat: string;
  /** Window size in world units. */
  winW: number;
  winH: number;
  frenzy: number;
}

function sprite(tex: THREE.Texture, w: number, h: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
}

export type SpeciesMotion = (species: string) => MotionProfile;

/**
 * Sim-driven train: locomotive + up to 8 glass aquarium carriages, side view
 * facing +X. The group origin is the front of the locomotive; carriages trail to -X.
 */
export class Train {
  readonly group = new THREE.Group();
  readonly steam = new Steam();
  readonly cars: CarView[] = [];
  /** Local X of the locomotive centre followed by each carriage centre. */
  centers: number[] = [];
  length = 0;
  private readonly art = hasAsset('train.carriage');
  private readonly geom: Geom = this.art ? CAR_ART : CAR_PH;
  private readonly locoArt = hasAsset('train.locomotive');
  private readonly loco: { group: THREE.Group; body: THREE.Group; wheels: Wheel[]; w: number; h: number };
  private readonly wheelSmall = toTexture(paintWheel(6, false), true);
  private readonly carTex: THREE.Texture;
  private rods: THREE.Mesh[] = [];
  private slosh = 0;
  private sloshVel = 0;
  private readonly chimney = new THREE.Vector3();
  private readonly hitGeo: THREE.PlaneGeometry;

  constructor(private readonly motionOf: SpeciesMotion) {
    this.carTex = loadTexture('train.carriage', () => paintCarriage(11), { pixel: true });
    this.hitGeo = new THREE.PlaneGeometry(this.geom.w, this.geom.h);
    this.loco = this.makeLoco();
    this.layout();
  }

  get sloshAmount(): number {
    return this.slosh;
  }

  private makeLoco() {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const w = this.locoArt ? LOCO_ART.w : LOCO.w;
    const h = this.locoArt ? LOCO_ART.h : LOCO.h;
    const tex = loadTexture('train.locomotive', paintLocomotive, { pixel: true });
    const m = sprite(tex, w, h);
    m.position.set(0, BODY_LIFT + h / 2, 0);
    body.add(m);
    const wheels: Wheel[] = [];
    if (!this.locoArt) {
      const big = toTexture(paintWheel(10, true), true);
      const r = 0.27;
      for (const wx of [-0.15, 0.48, 1.11]) {
        const wm = sprite(big, r * 2, r * 2);
        wm.position.set(wx, r, 0.02);
        group.add(wm);
        wheels.push({ mesh: wm, r });
      }
      const rod = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.06), new THREE.MeshBasicMaterial({ color: '#c9d2d6' }));
      rod.position.set(0.48, r, 0.03);
      group.add(rod);
      this.rods.push(rod);
    }
    // chimney position (art: stack at ~x 245/320, top at ~y 8/151)
    if (this.locoArt) this.chimney.set(w / 2 - 75 * ART_PX, BODY_LIFT + h - 0.05, 0);
    else this.chimney.set(w / 2 - 0.52, BODY_LIFT + h - 0.3, 0);
    this.group.add(group);
    return { group, body, wheels, w, h };
  }

  private makeCar(id: string): CarView {
    const g = this.geom;
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const frame = sprite(this.carTex, g.w, g.h);
    frame.position.set(0, BODY_LIFT + g.h / 2, 0.03);
    body.add(frame);
    const tank = createTank(3 + this.cars.length * 7, g.win.w + 0.04, g.win.h + 0.04);
    const wcx = -g.w / 2 + g.win.x + g.win.w / 2;
    const wcy = BODY_LIFT + g.win.y + g.win.h / 2;
    tank.mesh.position.set(wcx, wcy, -0.02);
    body.add(tank.mesh);
    const fishLayer = new THREE.Group();
    fishLayer.position.set(wcx, wcy, 0);
    body.add(fishLayer);
    const wheels: Wheel[] = [];
    if (!this.art) {
      const r = 0.17;
      for (const wx of [-0.95, -0.57, 0.57, 0.95]) {
        const w = sprite(this.wheelSmall, r * 2, r * 2);
        w.position.set(wx, r, 0.04);
        group.add(w);
        wheels.push({ mesh: w, r });
      }
    }
    const link = new THREE.Mesh(new THREE.PlaneGeometry(GAP + 0.16, 0.06), new THREE.MeshBasicMaterial({ color: '#34474c' }));
    // T-24: coupling bar at buffer height (car art buffers ~31 px above the wheel line), not floating by the rails
    link.position.set(g.w / 2 + GAP / 2, this.art ? BODY_LIFT + 31 * ART_PX : 0.26, -0.01);
    group.add(link);
    const hit = new THREE.Mesh(this.hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, BODY_LIFT + g.h / 2, 0.05);
    hit.userData.carId = id;
    group.add(hit);
    this.group.add(group);
    return {
      id, index: this.cars.length, group, body, fishLayer, tank, fish: new Map(), wheels, hit,
      phase: 0.7 + this.cars.length * 0.55, habitat: '', winW: g.win.w, winH: g.win.h, frenzy: 0,
    };
  }

  private layout(): void {
    let front = 0;
    this.loco.group.position.x = front - this.loco.w / 2;
    front -= this.loco.w + GAP;
    this.centers = [this.loco.group.position.x];
    this.cars.forEach((c, i) => {
      c.index = i;
      c.group.position.x = front - this.geom.w / 2;
      c.phase = 0.7 + (i + 1) * 0.55;
      this.centers.push(c.group.position.x);
      front -= this.geom.w + GAP;
    });
    this.length = -front;
  }

  /** Reconcile carriages and fish with the sim state. Returns true when the composition changed. */
  sync(s: SimState): boolean {
    let changed = false;
    const ids = s.carriages.map((c) => c.id);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c && !ids.includes(c.id)) {
        for (const f of c.fish.values()) f.dispose();
        this.group.remove(c.group);
        this.cars.splice(i, 1);
        changed = true;
      }
    }
    s.carriages.forEach((sc, i) => {
      let c = this.cars.find((x) => x.id === sc.id);
      if (!c) {
        c = this.makeCar(sc.id);
        this.cars.splice(i, 0, c);
        changed = true;
      }
      if (c.habitat !== sc.habitat) {
        c.habitat = sc.habitat;
        c.tank.setHabitat(sc.habitat);
      }
      // fish
      for (const [fid, fv] of c.fish) {
        const f = s.fish[fid];
        if (!f || f.carId !== c.id || f.shiny !== fv.shiny) {
          c.fishLayer.remove(fv.group);
          fv.dispose();
          c.fish.delete(fid);
        }
      }
      for (const fid of sc.fish) {
        const f = s.fish[fid];
        if (!f || c.fish.has(fid)) continue;
        const fv = new FishView(fid, f.species, f.shiny, this.motionOf(f.species), c.winW, c.winH);
        c.fish.set(fid, fv);
        c.fishLayer.add(fv.group);
      }
    });
    // keep sim order
    this.cars.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    if (changed) this.layout();
    return changed;
  }

  car(id: string): CarView | undefined {
    return this.cars.find((c) => c.id === id);
  }

  findFish(fishId: string): { car: CarView; fish: FishView } | null {
    for (const car of this.cars) {
      const fish = car.fish.get(fishId);
      if (fish) return { car, fish };
    }
    return null;
  }

  /** World position of a fish (or the car centre if unknown). */
  fishWorld(fishId: string, out = new THREE.Vector3()): THREE.Vector3 | null {
    const hit = this.findFish(fishId);
    if (!hit) return null;
    return hit.fish.mesh.getWorldPosition(out);
  }

  /** World position of a car's window centre. */
  carWorld(carId: string, out = new THREE.Vector3()): THREE.Vector3 | null {
    const c = this.car(carId);
    if (!c) return null;
    return c.fishLayer.getWorldPosition(out);
  }

  /** World Y of the carriage roof. */
  get roofY(): number {
    return this.group.position.y + BODY_LIFT + this.geom.h;
  }

  get carWidth(): number {
    return this.geom.w;
  }

  private lastGX = Number.NaN;
  /** Distance rolled (world units): drives wheels + rail joints so they match the actual motion (T-25). */
  private travel = 0;

  /** speed in world units/s, accel in units/s². */
  update(dt: number, time: number, speed: number, accel: number): void {
    const gx = this.group.position.x;
    let dx = Number.isFinite(this.lastGX) ? gx - this.lastGX : 0;
    if (Math.abs(dx) > 2) dx = speed * dt; // view snap (offline / wrap / depot): not real rolling
    this.lastGX = gx;
    this.travel += dx;
    // signature slosh: damped spring driven by acceleration
    this.sloshVel += (-accel * 0.35 - this.slosh * 14) * dt;
    this.sloshVel *= Math.exp(-dt * 3.2);
    this.slosh += this.sloshVel * dt;
    const sp = Math.min(1, speed / 2.5);
    const rock = (body: THREE.Group, phase: number) => {
      const joint = Math.pow(Math.max(0, Math.sin(this.travel * 1.7 - phase * 2)), 12);
      body.rotation.z = Math.sin(time * 2.1 + phase) * 0.006 * sp + joint * 0.006 * sp;
      body.position.y = joint * 0.025 * sp + Math.sin(time * 9 + phase) * 0.004 * sp;
    };
    rock(this.loco.body, 0);
    for (const w of this.loco.wheels) w.mesh.rotation.z -= dx / w.r;
    for (const c of this.cars) {
      rock(c.body, c.phase);
      for (const w of c.wheels) w.mesh.rotation.z -= dx / w.r;
      c.tank.setTilt(this.slosh * 1.6);
      c.tank.setFrenzy(c.frenzy);
      c.tank.update(time);
      for (const f of c.fish.values()) f.update(dt, time, this.slosh);
    }
    const a = this.loco.wheels[0]?.mesh.rotation.z ?? 0;
    for (const rod of this.rods) {
      rod.position.x = 0.48 + Math.cos(a) * 0.11;
      rod.position.y = 0.27 + Math.sin(a) * 0.11;
    }
    const origin = this.chimney.clone().add(this.loco.group.position).add(this.group.position);
    this.steam.update(dt, origin, speed);
  }
}
