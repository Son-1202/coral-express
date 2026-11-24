/** Scene actors: fish (single or instanced swarm) and plant/decor sprites. */
import * as THREE from 'three';
import type { DecorDef, GameData, Habitat, PlantDef, SpeciesDef } from '../../data/schema';
import type { PlacedDecor } from '../../sim/types';
import { createMover, isSwarm, type MotionBounds, type MotionEnv, type Mover } from './motion';
import { decorUrls, fishUrls, plantUrls, tankTexture } from './assets';
import { paintCap, paintDecor, paintFish, paintPlant } from './paint';
import { fishMaterial, plantMaterial, type FishUniforms, type PlantUniforms } from './shaders';
import { depthLook, TANK } from './layout';

/** Half-height (world units) per motion profile; tank is 16×9. */
const HALF_H: Record<string, number> = {
  darter: 0.42, hoverer: 0.72, glider: 0.6, sinuous: 0.5, crawler: 0.36, hopper: 0.4, pulser: 0.62, swarm: 0.08, sessile: 0.62,
};
const SPECIES_HALF_H: Record<string, number> = { pocket_whale: 0.78, ghost_ray: 0.7, tubeworm: 0.8 };

const texCache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = texCache.get(key);
  if (!t) texCache.set(key, (t = make()));
  return t;
}
export const fishTexture = (def: SpeciesDef): THREE.Texture => cached(`fish:${def.id}`, () => tankTexture(fishUrls(def.id), () => paintFish(def.id, def.motion)));
export const plantTexture = (id: string, habitat: Habitat, n: number): THREE.Texture => cached(`plant:${id}`, () => tankTexture(plantUrls(id), () => paintPlant(habitat, n)));
export const decorTexture = (id: string): THREE.Texture => cached(`decor:${id}`, () => tankTexture(decorUrls(id), () => paintDecor(id)));
const capTexture = (): THREE.Texture => cached('cap', () => tankTexture(['/ui/conductor_cap.png'], paintCap));

const aspectOf = (t: THREE.Texture): number => (t.userData.aspect as number | undefined) ?? 1;
const unitPlane = new THREE.PlaneGeometry(1, 1, 8, 4);

export interface FishSpec {
  fishId: string;
  def: SpeciesDef;
  level: number;
  shiny: boolean;
  mascot: boolean;
  seed: number;
}

/** Swim area in world units (the tank by default; zoo cells pass their own). */
export interface Area {
  x0: number;
  w: number;
  floor: number;
  surface: number;
  margin: number;
}
export const TANK_AREA: Area = { x0: 0, w: TANK.w, floor: TANK.floor, surface: TANK.surface, margin: TANK.margin };

export class FishActor {
  readonly object: THREE.Object3D;
  readonly mover: Mover;
  readonly uniforms: FishUniforms;
  readonly halfH: number;
  /** 0 = front glass … 1 = back wall. */
  readonly depth: number;
  private readonly tex: THREE.Texture;
  private readonly cap: THREE.Mesh | null = null;
  private readonly dummy = new THREE.Object3D();
  flash = 0;

  constructor(readonly spec: FishSpec, rand: () => number, readonly area: Area = TANK_AREA) {
    const { def } = spec;
    this.tex = fishTexture(def);
    this.halfH = (SPECIES_HALF_H[def.id] ?? HALF_H[def.motion] ?? 0.45) * (1 + Math.min(0.25, (spec.level - 1) * 0.01));
    this.depth = def.motion === 'sessile' || def.motion === 'crawler' ? 0.15 + rand() * 0.5 : rand();
    const profile = def.motion === 'glider' && def.motionVariant === 'sinuousTail' ? 'glider' : def.motion;
    const mat = fishMaterial(this.tex, rand() * 6.28);
    this.uniforms = mat.uniforms;
    if (def.motionVariant === 'sinuousTail') this.uniforms.uWave.value = 0.6;
    this.mover = createMover(profile, spec.seed, this.bounds(), { size: this.halfH, anchorX: area.x0 + area.margin + 0.6 + rand() * (area.w - 2 * area.margin - 1.2) });
    if (isSwarm(this.mover)) {
      const inst = new THREE.InstancedMesh(unitPlane, mat, this.mover.count);
      inst.frustumCulled = false;
      this.object = inst;
    } else {
      const mesh = new THREE.Mesh(unitPlane, mat);
      if (spec.mascot) {
        const ct = capTexture();
        const cap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthTest: false, depthWrite: false, alphaTest: 0.4 }));
        cap.renderOrder = 1;
        mesh.add(cap);
        this.cap = cap;
      }
      this.object = mesh;
    }
    this.object.userData.fishId = spec.fishId;
  }

  /** Motion bounds for the sprite centre (inset by half size so it never overlaps the glass frame). */
  bounds(): MotionBounds {
    const hh = this.halfH;
    const hw = isSwarmProfile(this.spec.def) ? hh * 1.5 : hh * aspectOf(this.tex);
    const a = this.area;
    const minX = a.x0 + a.margin + hw;
    const maxX = Math.max(minX, a.x0 + a.w - a.margin - hw);
    const minY = a.floor + hh * 0.9;
    return { minX, maxX, minY, maxY: Math.max(minY, a.surface - hh - 0.25), floorY: a.floor + hh * 0.8 };
  }

  update(dt: number, env: Omit<MotionEnv, 'bounds'>, time: number): void {
    const bounds = this.bounds();
    this.mover.step(dt, { ...env, bounds });
    const p = this.mover.pose;
    const look = depthLook(this.depth + p.depthBias);
    const u = this.uniforms;
    u.uTime.value = time;
    u.uFreq.value = p.wobbleFreq;
    u.uAmp.value = p.wobbleAmp;
    if (this.spec.def.motionVariant !== 'sinuousTail') u.uWave.value = p.wave;
    u.uTintAmt.value = look.tint;
    u.uAlpha.value = look.alpha;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    u.uFlash.value = this.flash > 0 ? Math.abs(Math.sin(this.flash * 18)) * 0.8 : 0;
    const z = 1 - (this.depth + p.depthBias) * 3; // nearer = higher z = drawn later
    const h = this.halfH * 2 * look.scale;
    const w = h * aspectOf(this.tex);
    if (isSwarm(this.mover) && this.object instanceof THREE.InstancedMesh) {
      const m = this.mover;
      const d = this.dummy;
      const aw = h * 1.5;
      for (let i = 0; i < m.count; i++) {
        const vx = m.vxs[i] as number;
        d.position.set(m.xs[i] as number, m.ys[i] as number, z + i * 0.0001);
        d.rotation.set(0, 0, Math.atan2(m.vys[i] as number, Math.abs(vx) + 1e-6) * 0.6 * (vx < 0 ? -1 : 1));
        d.scale.set(aw * (vx < 0 ? -1 : 1), h, 1);
        d.updateMatrix();
        this.object.setMatrixAt(i, d.matrix);
      }
      this.object.instanceMatrix.needsUpdate = true;
      this.object.position.set(0, 0, 0);
      return;
    }
    const o = this.object;
    o.position.set(p.x, p.y, z);
    o.scale.set(w * p.sx * p.facing, h * p.sy, 1);
    o.rotation.z = p.rot * p.facing;
    if (this.cap) {
      const capH = 0.42;
      const capAspect = aspectOf(capTexture());
      this.cap.scale.set((capH * h * capAspect) / Math.max(1e-3, w), capH, 1);
      this.cap.position.set(0.2, 0.5 + capH * 0.25, 0.01);
    }
  }

  /** Point-in-sprite test (world coords) with a little slack for small fish. */
  contains(x: number, y: number): boolean {
    const p = this.mover.pose;
    if (isSwarm(this.mover)) return Math.hypot(x - p.x, y - p.y) < 1.2;
    const h = this.halfH * depthLook(this.depth).scale;
    const w = h * aspectOf(this.tex);
    return Math.abs(x - p.x) < w + 0.2 && Math.abs(y - p.y) < h + 0.2;
  }

  dispose(): void {
    const m = (this.object as THREE.Mesh).material;
    if (m instanceof THREE.Material) m.dispose();
    if (this.object instanceof THREE.InstancedMesh) this.object.dispose();
  }
}

function isSwarmProfile(def: SpeciesDef): boolean {
  return def.motion === 'swarm';
}

/** Resolved look of a placed decor/plant id. */
export interface DecorLook {
  tex: THREE.Texture;
  freq: number;
  amp: number;
  /** World width target (plants: height target if tall). */
  size: number;
  isPlant: boolean;
}

export function decorLook(data: GameData, id: string): DecorLook {
  const d: DecorDef | undefined = data.decor.find((x) => x.id === id);
  const plantId = d?.plantId ?? (data.plants.some((p) => p.id === id) ? id : undefined);
  const plant: PlantDef | undefined = plantId ? data.plants.find((p) => p.id === plantId) : undefined;
  if (plant) {
    const n = Number(plant.id.split('_')[1] ?? 1);
    const sway = d?.sway ?? plant.sway;
    return { tex: plantTexture(plant.id, plant.habitat, n), freq: sway.freq * 2.2, amp: sway.amp * TANK.w * 0.5, size: 2.3, isPlant: true };
  }
  const cap = d?.capacity ?? 1;
  return { tex: decorTexture(id), freq: 0, amp: 0, size: 1.6 + 0.75 * cap, isPlant: false };
}

/** A placed plant/decor sprite anchored at its bottom-centre, swaying via the plant shader. */
export class DecorActor {
  readonly mesh: THREE.Mesh;
  readonly uniforms: PlantUniforms;
  private bendT = 0;
  private bendDir = 0;
  private static geo = (() => {
    const g = new THREE.PlaneGeometry(1, 1, 1, 8);
    g.translate(0, 0.5, 0);
    return g;
  })();

  constructor(readonly look: DecorLook, public placed: PlacedDecor, readonly index: number) {
    const mat = plantMaterial(look.tex, look.freq, look.amp);
    this.uniforms = mat.uniforms;
    this.mesh = new THREE.Mesh(DecorActor.geo, mat);
    this.mesh.userData.decorIndex = index;
    this.layout();
  }

  /** World size from texture aspect: plants by height, decor by width. */
  size(): { w: number; h: number } {
    const a = aspectOf(this.look.tex);
    const s = this.placed.scale;
    if (this.look.isPlant) {
      const h = (a < 0.55 ? 4.6 : this.look.size) * s;
      return { w: h * a, h };
    }
    const w = this.look.size * s;
    return { w, h: w / a };
  }

  layout(): void {
    const { w, h } = this.size();
    const p = this.placed;
    this.mesh.position.set(p.x * TANK.w, p.y * TANK.h - (p.layer === 'front' ? 0 : 0.15), p.layer === 'front' ? 3 + p.x * 0.01 : -4 + p.x * 0.01);
    this.mesh.scale.set(w * (p.flip ? -1 : 1), h, 1);
    const far = p.layer === 'back' ? 0.12 : 0;
    this.uniforms.uTintAmt.value = far;
  }

  /** Bend away from a passing fish for 0.5 s. */
  nudge(fromX: number): void {
    this.bendDir = Math.sign(this.mesh.position.x - fromX) || 1;
    this.bendT = 0.5;
  }

  update(dt: number, time: number, tilt: number): void {
    this.bendT = Math.max(0, this.bendT - dt);
    const target = this.bendT > 0 && this.look.isPlant ? this.bendDir * 0.35 : 0;
    const u = this.uniforms;
    u.uBend.value += (target - u.uBend.value) * (1 - Math.exp(-10 * dt));
    u.uLean.value = this.look.isPlant ? -tilt * 2.2 : 0;
    u.uTime.value = time;
  }

  contains(x: number, y: number): boolean {
    const { w, h } = this.size();
    const p = this.mesh.position;
    return Math.abs(x - p.x) < Math.abs(w) / 2 + 0.1 && y > p.y - 0.1 && y < p.y + h;
  }

  dispose(): void {
    (this.mesh.material as THREE.Material).dispose();
  }
}
