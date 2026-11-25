import * as THREE from 'three';
import { makeCanvas } from '../paint/canvas';
import { LAYER_Z } from '../diorama/config';
import { LINE_LAYOUT } from '../diorama/lineArt';
import { CENTER_GEO, atDepth, fogBand, halfWidth, rng, softPuff } from './util';

/** Tiny gull silhouette (two wing strokes) for the distant flock. */
let gullTex: THREE.CanvasTexture | null = null;
function gullTexture(): THREE.Texture {
  if (gullTex) return gullTex;
  const p = makeCanvas(12, 6);
  const c = p.ctx;
  c.fillStyle = '#f4f2ea';
  c.fillRect(0, 1, 2, 1);
  c.fillRect(2, 2, 2, 1);
  c.fillRect(4, 3, 4, 1);
  c.fillRect(8, 2, 2, 1);
  c.fillRect(10, 1, 2, 1);
  c.fillStyle = '#6c7a82';
  c.fillRect(5, 4, 2, 1);
  gullTex = new THREE.CanvasTexture(p.canvas);
  gullTex.magFilter = THREE.NearestFilter;
  gullTex.minFilter = THREE.NearestFilter;
  gullTex.colorSpace = THREE.SRGBColorSpace;
  return gullTex;
}

const FLOCK_Z = -45;

/** Distant gull flock: classic boids (cohesion, alignment, separation) + a drift goal. */
export class GullFlock {
  readonly group = new THREE.Group();
  private readonly birds: { m: THREE.Mesh; p: THREE.Vector2; v: THREE.Vector2; ph: number }[] = [];
  private active = false;
  private wait = 3;
  private dir = 1;
  private readonly mat = new THREE.MeshBasicMaterial({ map: gullTexture(), transparent: true, alphaTest: 0.3, fog: false, depthWrite: false });
  private readonly tmp = new THREE.Vector2();

  constructor(n = 8) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(CENTER_GEO, this.mat);
      m.frustumCulled = false;
      m.renderOrder = -5;
      this.group.add(m);
      this.birds.push({ m, p: new THREE.Vector2(), v: new THREE.Vector2(), ph: Math.random() * 6 });
    }
    this.group.visible = false;
  }

  update(dt: number, time: number, camera: THREE.PerspectiveCamera): void {
    const cam = camera.position;
    const half = halfWidth(camera) * ((cam.z - FLOCK_Z) / cam.z);
    if (!this.active) {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.active = true;
      this.group.visible = true;
      this.dir = Math.random() < 0.5 ? 1 : -1;
      const c = atDepth(cam, cam.x, 4.7 + Math.random() * 0.6, FLOCK_Z);
      for (const b of this.birds) {
        b.p.set(cam.x - this.dir * (half + 3) + (Math.random() - 0.5) * 6, c.y + (Math.random() - 0.5) * 3);
        b.v.set(this.dir * 3, 0);
      }
    }
    const n = this.birds.length;
    let cx = 0;
    let cy = 0;
    let vx = 0;
    let vy = 0;
    for (const b of this.birds) {
      cx += b.p.x;
      cy += b.p.y;
      vx += b.v.x;
      vy += b.v.y;
    }
    cx /= n;
    cy /= n;
    vx /= n;
    vy /= n;
    const goalY = atDepth(cam, cam.x, 5, FLOCK_Z).y;
    let anyVisible = false;
    for (const b of this.birds) {
      const acc = this.tmp.set((cx - b.p.x) * 0.25 + (vx - b.v.x) * 0.6, (cy - b.p.y) * 0.25 + (vy - b.v.y) * 0.6 + (goalY - b.p.y) * 0.08);
      for (const o of this.birds) {
        if (o === b) continue;
        const dx = b.p.x - o.p.x;
        const dy = b.p.y - o.p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 2.2 && d2 > 1e-4) {
          acc.x += (dx / d2) * 0.9;
          acc.y += (dy / d2) * 0.9;
        }
      }
      acc.x += (this.dir * 3.2 - b.v.x) * 0.5 + Math.sin(time * 0.7 + b.ph) * 0.4;
      acc.y += Math.cos(time * 0.9 + b.ph) * 0.3;
      b.v.addScaledVector(acc, dt);
      const sp = b.v.length();
      if (sp > 4.5) b.v.multiplyScalar(4.5 / sp);
      b.p.addScaledVector(b.v, dt);
      b.m.position.set(b.p.x, b.p.y, FLOCK_Z);
      const flap = Math.sin(time * 9 + b.ph * 3);
      b.m.scale.set(0.95 * this.dir, 0.48 * (0.55 + 0.45 * Math.abs(flap)), 1);
      b.m.rotation.z = Math.atan2(b.v.y, Math.abs(b.v.x)) * 0.5 * this.dir;
      if (Math.abs(b.p.x - cam.x) < half + 6) anyVisible = true;
    }
    // once the flock has crossed and left, rest for a while before the next one
    if (!anyVisible && Math.sign(cx - cam.x) === this.dir) {
      this.active = false;
      this.group.visible = false;
      this.wait = 15 + Math.random() * 20;
    }
  }
}

/** Soft drifting clouds in front of the painted sky (the painting's own clouds stay put). */
export class Clouds {
  readonly group = new THREE.Group();
  private readonly puffs: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; x: number; y: number; s: number; speed: number }[] = [];

  constructor(n = 5) {
    const r = rng(17);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: softPuff(), transparent: true, depthWrite: false, fog: false, opacity: 0.45 });
      const m = new THREE.Mesh(CENTER_GEO, mat);
      m.frustumCulled = false;
      m.renderOrder = -7;
      this.group.add(m);
      this.puffs.push({ m, mat, x: (r() - 0.5) * 120, y: 9 + r() * 7, s: 10 + r() * 10, speed: 0.4 + r() * 0.5 });
    }
  }

  setTint(color: string): void {
    for (const p of this.puffs) p.mat.color.set(color);
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const z = LAYER_Z.midFar - 20;
    const span = 140;
    for (const p of this.puffs) {
      p.x += p.speed * dt;
      // wrap around the camera so clouds never run out
      const cx = camera.position.x;
      while (p.x - cx > span / 2) p.x -= span;
      while (cx - p.x > span / 2) p.x += span;
      p.m.position.set(p.x, p.y, z);
      p.m.scale.set(p.s * 1.8, p.s * 0.55, 1);
    }
  }
}

/**
 * Line 3 volcano smoke: puffs rise from the crater painted in `l3_far`.
 * The far strip alternates painting / mirror every tile, so the crater sits at
 * ±CRATER_U of each tile centre.
 */
const CRATER_U = 0.307; // fraction of the painting width
const CRATER_V = 0.34; // fraction of the painting height from the top
export class VolcanoSmoke {
  readonly group = new THREE.Group();
  private readonly puffs: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; life: number; vx: number; ox: number }[] = [];
  private t = 0;
  private aspect = 1156 / 2560;

  constructor(n = 14) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: softPuff(), transparent: true, depthWrite: false, fog: false, color: '#e9e2da', opacity: 0 });
      const m = new THREE.Mesh(CENTER_GEO, mat);
      m.frustumCulled = false;
      m.renderOrder = -7;
      this.group.add(m);
      this.puffs.push({ m, mat, age: (i / n) * 9, life: 9, vx: 0.6 + Math.random() * 0.4, ox: (Math.random() - 0.5) * 0.6 });
    }
  }

  /** Painting aspect (h / w) once known. */
  setAspect(a: number): void {
    this.aspect = a;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    this.t += dt;
    const far = LINE_LAYOUT.find((l) => l.layer === 'far');
    if (!far) return;
    const W = far.width;
    const H = W * this.aspect;
    const yTop = far.anchorY - far.anchorV * H + H;
    const k = Math.floor(camera.position.x / W + 0.5);
    // crater of the nearest visible tile (even tiles: painting, odd: mirror)
    const cx = k * W + (k % 2 === 0 ? 1 : -1) * (CRATER_U - 0.5) * W;
    const cy = yTop - CRATER_V * H;
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age > p.life) p.age -= p.life;
      const u = p.age / p.life;
      p.m.position.set(cx + p.ox + u * 9 * p.vx, cy + u * 11, LAYER_Z.far + 1);
      const s = 2.2 + u * 9;
      p.m.scale.set(s * 1.3, s, 1);
      p.mat.opacity = Math.min(1, u * 6) * (1 - u) * 0.55;
    }
  }
}

/** Line 2 fog banks drifting along the fjord with layered sine noise. */
export class FogBanks {
  readonly group = new THREE.Group();
  private readonly banks: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; x: number; y0: number; z: number; w: number; ph: number; sp: number }[] = [];
  private t = 0;

  constructor() {
    const r = rng(23);
    const layers = [
      { z: -110, y0: 2.95, w: 90, n: 3 },
      { z: -55, y0: 2.75, w: 50, n: 3 },
      { z: -12, y0: 2.35, w: 22, n: 3 },
    ];
    for (const L of layers)
      for (let i = 0; i < L.n; i++) {
        const mat = new THREE.MeshBasicMaterial({ map: fogBand(), transparent: true, depthWrite: false, fog: false, color: '#eef2f4', opacity: 0.7 });
        const m = new THREE.Mesh(CENTER_GEO, mat);
        m.frustumCulled = false;
        m.renderOrder = -6;
        this.group.add(m);
        this.banks.push({ m, mat, x: (i / L.n - 0.5) * L.w * 3 + r() * L.w, y0: L.y0, z: L.z, w: L.w, ph: r() * 10, sp: 0.3 + r() * 0.5 });
      }
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    this.t += dt;
    const cam = camera.position;
    for (const b of this.banks) {
      const span = b.w * 3;
      b.x += b.sp * dt;
      while (b.x - cam.x > span / 2) b.x -= span;
      while (cam.x - b.x > span / 2) b.x += span;
      const n = Math.sin(this.t * 0.11 + b.ph) * 0.6 + Math.sin(this.t * 0.27 + b.ph * 2) * 0.3;
      const p = atDepth(cam, cam.x, b.y0 + n * 0.12, b.z);
      b.m.position.set(b.x + n * 2, p.y, b.z);
      const k = (cam.z - b.z) / cam.z;
      b.m.scale.set(b.w, 1.4 * k * (1 + n * 0.15), 1);
      b.mat.opacity = 0.55 + n * 0.2;
    }
  }
}
