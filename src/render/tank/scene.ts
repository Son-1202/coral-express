/** Tank scene for one carriage: water layers, plants/decor, fish, bubbles, motes, food; camera. */
import * as THREE from 'three';
import type { GameData, Habitat } from '../../data/schema';
import type { Carriage, PlacedDecor, SimState } from '../../sim/types';
import { FishActor, DecorActor, decorLook, plantTexture } from './actors';
import { backdropUrls, coastUrls, tankTexture } from './assets';
import { HABITAT_COLORS, paintBackdrop, paintCoast } from './paint';
import { PointCloud } from './shaders';
import { createWater, type WaterLayers } from './water';
import { Slosh } from './slosh';
import { TANK } from './layout';
import { makeRng, type Point } from './motion';

export interface TankSource {
  data: GameData;
  state(): SimState;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 0.3;

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const texCache = new Map<string, THREE.Texture>();
const tex = (key: string, make: () => THREE.Texture) => {
  let t = texCache.get(key);
  if (!t) texCache.set(key, (t = make()));
  return t;
};

interface Pellet {
  x: number;
  y: number;
  age: number;
}

export class TankScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);
  readonly water: WaterLayers = createWater();
  readonly slosh = new Slosh();
  readonly fish = new Map<string, FishActor>();
  decor: DecorActor[] = [];
  private ambient: DecorActor[] = [];
  private readonly bubbles = new PointCloud(48, '#e8fbff', true);
  private readonly motes = new PointCloud(70, '#f4fff8', false);
  private readonly food = new PointCloud(16, '#a8743f', false);
  private pellets: Pellet[] = [];
  private bubbleSeeds = Array.from({ length: 48 }, (_, i) => ({ y: (i / 48) * TANK.h, ph: i * 1.7, sp: 0.9 + (i % 5) * 0.15, src: i }));
  private moteState = Array.from({ length: 70 }, (_, i) => ({ x: ((i * 37) % 100) / 100 * TANK.w, y: TANK.floor + (((i * 61) % 100) / 100) * (TANK.surface - TANK.floor), ph: i }));
  private readonly fishLayer = new THREE.Group();
  private readonly decorLayer = new THREE.Group();
  carId = '';
  time = 0;
  private scroll = 0;
  private keys = { fish: '', decor: '', cos: '' };
  /** Fish the camera follows (watch mode). */
  follow: string | null = null;
  private view = { x: TANK.w / 2, y: TANK.h / 2, zoom: 1 };
  /** Decor preview while dragging (index → placement), drawn instead of the sim's value. */
  preview: { index: number; placed: PlacedDecor } | null = null;

  constructor(private readonly src: TankSource) {
    this.scene.add(this.water.group, this.decorLayer, this.fishLayer, this.bubbles.points, this.motes.points, this.food.points);
    this.bubbles.points.renderOrder = 50;
    this.motes.points.renderOrder = 40;
    this.motes.points.position.z = 2;
    this.food.points.renderOrder = 45;
  }

  car(): Carriage | undefined {
    return this.src.state().carriages.find((c) => c.id === this.carId);
  }

  setCar(carId: string): void {
    this.carId = carId;
    this.keys = { fish: '', decor: '', cos: '' };
    for (const f of this.fish.values()) f.dispose();
    this.fish.clear();
    this.fishLayer.clear();
    this.pellets = [];
    this.follow = null;
    this.view = { x: TANK.w / 2, y: TANK.h / 2, zoom: 1 };
    this.sync();
  }

  /** Re-read the sim: fish set, decor, cosmetics (cheap string keys; rebuild only on change). */
  sync(): void {
    const car = this.car();
    if (!car) return;
    const st = this.src.state();
    const fishKey = car.fish.map((id) => `${id}:${st.fish[id]?.species}:${st.fish[id]?.mascot ? 1 : 0}`).join(',');
    if (fishKey !== this.keys.fish) {
      this.keys.fish = fishKey;
      this.syncFish(car, st);
    }
    const decorKey = JSON.stringify(car.decor) + car.habitat;
    if (decorKey !== this.keys.decor) {
      this.keys.decor = decorKey;
      this.buildDecor(car);
    }
    const cosKey = `${car.habitat}|${car.cosmetics.sand}|${car.cosmetics.backdrop}|${car.cosmetics.paint}|${st.currentLine}`;
    if (cosKey !== this.keys.cos) {
      this.keys.cos = cosKey;
      this.applyCosmetics(car, st);
    }
  }

  private syncFish(car: Carriage, st: SimState): void {
    const want = new Set(car.fish);
    for (const [id, a] of this.fish) {
      if (!want.has(id) || st.fish[id]?.species !== a.spec.def.id || !!st.fish[id]?.mascot !== a.spec.mascot) {
        this.fishLayer.remove(a.object);
        a.dispose();
        this.fish.delete(id);
      }
    }
    for (const id of car.fish) {
      if (this.fish.has(id)) continue;
      const f = st.fish[id];
      const def = f && this.src.data.species.find((s) => s.id === f.species);
      if (!f || !def) continue;
      const seed = hashId(id);
      const a = new FishActor({ fishId: id, def, level: f.level, shiny: f.shiny, mascot: !!f.mascot, seed }, makeRng(seed));
      this.fish.set(id, a);
      this.fishLayer.add(a.object);
    }
  }

  private buildDecor(car: Carriage): void {
    for (const d of [...this.decor, ...this.ambient]) d.dispose();
    this.decorLayer.clear();
    this.decor = car.decor.map((p, i) => new DecorActor(decorLook(this.src.data, p.id), { ...p }, i));
    // two ambient habitat plants at the back so even an empty tank feels alive
    const h: Habitat = car.habitat;
    this.ambient = [1, 3].map((n, i) => {
      const id = `${h}_${n}`;
      const plant = this.src.data.plants.find((p) => p.id === id);
      const look = { tex: plantTexture(id, h, n), freq: (plant?.sway.freq ?? 1) * 2.2, amp: (plant?.sway.amp ?? 0.01) * TANK.w * 0.5, size: 2.1, isPlant: true };
      const a = new DecorActor(look, { id, x: i ? 0.94 : 0.06, y: TANK.floor / TANK.h, layer: 'back', scale: 0.85, flip: i === 1 }, -1);
      a.mesh.position.z -= 1;
      a.uniforms.uTintAmt.value = 0.3;
      return a;
    });
    for (const d of [...this.ambient, ...this.decor]) this.decorLayer.add(d.mesh);
  }

  private applyCosmetics(car: Carriage, st: SimState): void {
    const c = this.src.data.cosmetics;
    const bd = c.backdrops.find((b) => b.id === car.cosmetics.backdrop && b.habitat === car.habitat) ?? c.backdrops.find((b) => b.habitat === car.habitat && b.isDefault);
    const variant = bd?.id ?? `backdrop_${car.habitat}_0`;
    const back = tex(`back:${car.habitat}`, () => tankTexture(backdropUrls(car.habitat, variant), () => paintBackdrop(car.habitat)));
    this.water.setBackdrop(back, bd?.tint ?? '#ffffff', bd && !bd.isDefault ? 0.35 : 0);
    this.water.setCoast(tex(`coast:${st.currentLine}`, () => tankTexture(coastUrls(st.currentLine), () => paintCoast(st.currentLine))));
    this.water.setSand(c.sand.find((s) => s.id === car.cosmetics.sand)?.hex ?? '#f2e2bd');
    this.water.setPaint(c.paints.find((s) => s.id === car.cosmetics.paint)?.hex ?? '#8fd1b8');
    const deep = HABITAT_COLORS[car.habitat].deep;
    for (const f of this.fish.values()) f.uniforms.uTint.value.set(deep);
  }

  dropFood(x: number, y: number): void {
    for (let i = 0; i < 3; i++) this.pellets.push({ x: x + (i - 1) * 0.18, y: y + (i % 2) * 0.1, age: 0 });
    while (this.pellets.length > 15) this.pellets.shift();
  }

  /** Advance everything. `trainSpeed` = 0..1 (drifts the coast behind the back glass). */
  update(dt: number, trainSpeed: number): void {
    this.sync();
    this.time += dt;
    const t = this.time;
    const tilt = this.slosh.update(dt);
    this.scroll += trainSpeed * dt * 0.03;
    this.water.update(t, tilt, this.scroll);
    const deep = HABITAT_COLORS[this.car()?.habitat ?? 'reef'].deep;
    const neighbors: Point[] = [...this.fish.values()].map((f) => f.mover.pose);
    const anchors: Point[] = this.decor.filter((d) => d.look.isPlant).map((d) => ({ x: d.mesh.position.x, y: d.mesh.position.y }));
    // food pellets sink, rest on the sand, fade
    for (const p of this.pellets) {
      p.age += dt;
      if (p.y > TANK.floor + 0.1) p.y -= dt * 0.55;
      p.x += Math.sin(t * 2 + p.age * 3) * dt * 0.1 + tilt * dt;
    }
    this.pellets = this.pellets.filter((p) => p.age < 9);
    for (const f of this.fish.values()) {
      const pose = f.mover.pose;
      let food: Point | null = null;
      let best = Infinity;
      for (const p of this.pellets) {
        const d = Math.hypot(p.x - pose.x, p.y - pose.y);
        if (d < best) (best = d), (food = p);
      }
      if (food && best < f.halfH + 0.25) {
        this.pellets.splice(this.pellets.indexOf(food as Pellet), 1);
        f.mover.kick();
        food = null;
      }
      f.uniforms.uTint.value.set(deep);
      f.update(dt, { time: t, tilt, food, neighbors, anchors }, t);
      // plants bend away from a passing fish
      for (const d of this.decor) {
        if (!d.look.isPlant) continue;
        const dp = d.mesh.position;
        if (Math.abs(pose.x - dp.x) < 0.7 && pose.y < dp.y + d.size().h && pose.speed > 0.1) d.nudge(pose.x);
      }
    }
    if (this.preview) {
      const d = this.decor[this.preview.index];
      if (d) {
        d.placed = this.preview.placed;
        d.layout();
      }
    }
    for (const d of [...this.decor, ...this.ambient]) d.update(dt, t, tilt);
    this.updateParticles(dt, tilt);
    this.updateCamera(dt);
  }

  private updateParticles(dt: number, tilt: number): void {
    const t = this.time;
    const sources: Point[] = [{ x: TANK.w * 0.86, y: TANK.floor + 0.1 }];
    for (const d of this.decor) if (d.placed.id === 'treasure_chest') sources.push({ x: d.mesh.position.x, y: d.mesh.position.y + 0.4 });
    const b = this.bubbles;
    this.bubbleSeeds.forEach((s, i) => {
      const src = sources[s.src % sources.length] as Point;
      s.y += dt * s.sp * 1.6;
      if (s.y > TANK.surface - src.y) s.y = 0;
      b.pos[i * 3] = src.x + Math.sin(t * 3 + s.ph) * 0.12 + tilt * s.y * 0.15;
      b.pos[i * 3 + 1] = src.y + s.y;
      b.pos[i * 3 + 2] = 5;
      b.size[i] = 0.1 + (i % 4) * 0.05 + s.y * 0.012;
      b.alpha[i] = 0.85;
    });
    const m = this.motes;
    this.moteState.forEach((s, i) => {
      s.x += (Math.sin(t * 0.3 + s.ph) * 0.08 + tilt * 0.8) * dt;
      s.y += Math.cos(t * 0.25 + s.ph * 1.3) * 0.05 * dt;
      if (s.x < 0) s.x += TANK.w;
      if (s.x > TANK.w) s.x -= TANK.w;
      m.pos[i * 3] = s.x;
      m.pos[i * 3 + 1] = s.y;
      m.size[i] = 0.035 + (i % 3) * 0.02;
      m.alpha[i] = 0.25 + 0.25 * Math.sin(t + s.ph) ** 2;
    });
    const f = this.food;
    for (let i = 0; i < f.capacity; i++) {
      const p = this.pellets[i];
      f.pos[i * 3] = p?.x ?? -99;
      f.pos[i * 3 + 1] = p?.y ?? -99;
      f.size[i] = 0.12;
      f.alpha[i] = p ? Math.min(1, (9 - p.age) / 2) : 0;
    }
  }

  private updateCamera(dt: number): void {
    const f = this.follow ? this.fish.get(this.follow) : undefined;
    const target = f ? { x: f.mover.pose.x, y: f.mover.pose.y, zoom: 2 } : { x: TANK.w / 2, y: TANK.h / 2, zoom: 1 };
    const k = 1 - Math.exp(-4 * dt);
    this.view.x += (target.x - this.view.x) * k;
    this.view.y += (target.y - this.view.y) * k;
    this.view.zoom += (target.zoom - this.view.zoom) * k;
  }

  /** Visible half-extents for a viewport aspect at zoom 1 ("contain" the tank + frame). */
  private halfExtents(aspect: number): { hw: number; hh: number } {
    const hh = Math.max((TANK.h + 2 * PAD) / 2, (TANK.w + 2 * PAD) / 2 / aspect);
    return { hw: hh * aspect, hh };
  }

  layoutCamera(aspect: number): void {
    const { hw, hh } = this.halfExtents(aspect);
    const z = this.view.zoom;
    const vhw = hw / z;
    const vhh = hh / z;
    // keep the zoomed view inside the tank (+pad)
    const cx = Math.min(Math.max(this.view.x, -PAD + vhw), TANK.w + PAD - vhw);
    const cy = Math.min(Math.max(this.view.y, -PAD + vhh), TANK.h + PAD - vhh);
    const c = this.camera;
    c.left = -hw;
    c.right = hw;
    c.top = hh;
    c.bottom = -hh;
    c.zoom = z;
    c.position.set(z > 1.001 ? cx : TANK.w / 2, z > 1.001 ? cy : TANK.h / 2, 20);
    c.updateProjectionMatrix();
  }

  /** CSS-pixel point inside `rect` → tank world coords. */
  screenToWorld(px: number, py: number, rect: Rect): Point {
    this.layoutCamera(rect.w / rect.h);
    const nx = ((px - rect.x) / rect.w) * 2 - 1;
    const ny = -(((py - rect.y) / rect.h) * 2 - 1);
    const v = new THREE.Vector3(nx, ny, 0).unproject(this.camera);
    return { x: v.x, y: v.y };
  }

  worldToScreen(x: number, y: number, rect: Rect): Point {
    this.layoutCamera(rect.w / rect.h);
    const v = new THREE.Vector3(x, y, 0).project(this.camera);
    return { x: rect.x + ((v.x + 1) / 2) * rect.w, y: rect.y + ((1 - v.y) / 2) * rect.h };
  }

  pickFish(x: number, y: number): string | null {
    let best: { id: string; d: number } | null = null;
    for (const [id, f] of this.fish) {
      if (!f.contains(x, y)) continue;
      const d = Math.hypot(f.mover.pose.x - x, f.mover.pose.y - y) + f.depth;
      if (!best || d < best.d) best = { id, d };
    }
    return best?.id ?? null;
  }

  pickDecor(x: number, y: number): DecorActor | null {
    // front band first, then nearest-x
    const hits = this.decor.filter((d) => d.contains(x, y));
    hits.sort((a, b) => b.mesh.position.z - a.mesh.position.z);
    return hits[0] ?? null;
  }

  /** Draw into a CSS-pixel rect of the renderer's canvas (top-left origin), on top of what's there. */
  render(renderer: THREE.WebGLRenderer, rect: Rect): void {
    const size = renderer.getSize(new THREE.Vector2());
    this.layoutCamera(rect.w / Math.max(1, rect.h));
    this.commitPoints(rect.h * renderer.getPixelRatio());
    const prevAuto = renderer.autoClear;
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    const y = size.y - rect.y - rect.h;
    renderer.setViewport(rect.x, y, rect.w, rect.h);
    renderer.setScissor(rect.x, y, rect.w, rect.h);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
    renderer.autoClear = prevAuto;
  }

  private commitPoints(pxHeight: number): void {
    const worldH = (this.camera.top - this.camera.bottom) / this.camera.zoom;
    const s = pxHeight / worldH;
    this.bubbles.commit(s);
    this.motes.commit(s);
    this.food.commit(s);
  }

  /** Render the tank (no UI) at w×h into a fresh 2D canvas — used by photo mode. */
  capture(renderer: THREE.WebGLRenderer, w: number, h: number): HTMLCanvasElement {
    const rt = new THREE.WebGLRenderTarget(w, h);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.layoutCamera(w / h);
    this.commitPoints(h);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    renderer.setRenderTarget(prev);
    rt.dispose();
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(w, h);
      for (let row = 0; row < h; row++) img.data.set(buf.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
      ctx.putImageData(img, 0, 0);
    }
    return out;
  }

  dispose(): void {
    for (const f of this.fish.values()) f.dispose();
    for (const d of [...this.decor, ...this.ambient]) d.dispose();
    this.bubbles.dispose();
    this.motes.dispose();
    this.food.dispose();
  }
}
