import * as THREE from 'three';
import { clamp01, smoothstep } from '../anim/ease';
import { makeCanvas } from '../paint/canvas';
import { FishView, fishSize, fishTexture } from '../train/fishView';
import type { SpeciesMotion } from '../train/train';

/** World rectangle of the swimmable water (centre + size), on the pool plane. */
export interface WaterRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  z: number;
}

interface Jumper {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t0: number;
  dur: number;
  view: FishView;
}

interface Ripple {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t0: number;
}

interface Drop {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  t0: number;
  y0: number;
}

/** Pool fish are drawn a little smaller than in the carriages (it is further from the camera). */
const POOL_SCALE = 0.82;
const JUMP = 0.95;
const RIPPLE_LIFE = 1.1;

let rippleTex: THREE.Texture | null = null;
function ring(): THREE.Texture {
  if (rippleTex) return rippleTex;
  const p = makeCanvas(64, 24);
  const g = p.ctx;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(32, 12, 29, 9, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(32, 12, 18, 5, 0, 0, Math.PI * 2);
  g.stroke();
  rippleTex = new THREE.CanvasTexture(p.canvas);
  rippleTex.colorSpace = THREE.SRGBColorSpace;
  return rippleTex;
}

let dotTex: THREE.Texture | null = null;
function dot(): THREE.Texture {
  if (dotTex) return dotTex;
  const p = makeCanvas(8, 8);
  p.ctx.fillStyle = '#ffffff';
  p.ctx.beginPath();
  p.ctx.arc(4, 4, 3.5, 0, Math.PI * 2);
  p.ctx.fill();
  dotTex = new THREE.CanvasTexture(p.canvas);
  return dotTex;
}

/**
 * Fish leaving the carriages for the depot pool: a hop through the air, a splash + ripple where
 * each one enters the water, then they swim *inside* the water band with their T-15 motion
 * profile (FishView + createMover). Containment: the mover keeps every sprite inside the
 * water rectangle, and `clampInside` reins in swarm companions; the pool's see-through water
 * layer (drawn in front) makes them read as under the surface.
 */
export class PoolFish {
  readonly group = new THREE.Group();
  private readonly swim = new THREE.Group();
  private jumpers: Jumper[] = [];
  private swimmers: FishView[] = [];
  private ripples: Ripple[] = [];
  private drops: Drop[] = [];
  private n = 0;

  constructor(
    private readonly water: WaterRect,
    private readonly motionOf: SpeciesMotion,
    private readonly renderOrder: number,
  ) {
    this.swim.position.set(water.cx, water.cy, water.z);
    this.group.add(this.swim);
  }

  get count(): number {
    return this.n;
  }

  /** A fish jumps from `from` (world) at scene time `t0`. */
  add(f: { id: string; species: string; shiny: boolean }, from: THREE.Vector3, t0: number): void {
    const w = this.water;
    const k = this.n++;
    const view = new FishView(f.id, f.species, f.shiny, this.motionOf(f.species), w.w, w.h);
    view.group.scale.setScalar(POOL_SCALE);
    // FishView sizes its mover bounds for a full-size sprite in a (w,h) tank; our group scale
    // shrinks the sprite, so the bounds are conservative (the sprite stays well inside).
    view.group.visible = false;
    view.mesh.renderOrder = this.renderOrder;
    view.group.traverse((o) => (o.renderOrder = this.renderOrder));
    this.swim.add(view.group);
    // landing spot spread over the water, deterministic
    const lx = (((k * 0.618 + 0.13) % 1) - 0.5) * 0.8;
    const ly = (((k * 0.414 + 0.37) % 1) - 0.5) * 0.5;
    view.mover.pose.x = lx;
    view.mover.pose.y = Math.max(-0.3, ly);
    const to = new THREE.Vector3(w.cx + lx * w.w * POOL_SCALE, w.cy + view.mover.pose.y * w.h * POOL_SCALE, w.z);
    const tex = fishTexture(f.species, f.shiny);
    const sz = fishSize(tex);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4 }));
    mesh.scale.set(sz.w * 1.05, sz.h * 1.05, 1);
    mesh.position.copy(from);
    mesh.renderOrder = this.renderOrder + 3;
    this.group.add(mesh);
    this.jumpers.push({ mesh, from: from.clone(), to, t0, dur: JUMP, view });
  }

  update(dt: number, t: number): void {
    for (const j of this.jumpers) {
      const u = clamp01((t - j.t0) / j.dur);
      if (t < j.t0) continue;
      const m = j.mesh;
      m.position.lerpVectors(j.from, j.to, smoothstep(u));
      // ballistic hop that ends diving into the water surface
      m.position.y += Math.sin(u * Math.PI) * 2.0;
      const dir = j.to.x >= j.from.x ? 1 : -1;
      m.rotation.z = (0.6 - u * 1.4) * dir;
      m.scale.x = Math.abs(m.scale.x) * dir;
      if (u >= 1) {
        m.visible = false;
        j.view.group.visible = true;
        j.view.wiggle = 1;
        this.splash(j.to, t);
      }
    }
    this.jumpers = this.jumpers.filter((j) => {
      if (j.mesh.visible) return true;
      j.mesh.removeFromParent();
      (j.mesh.material as THREE.Material).dispose();
      j.mesh.geometry.dispose();
      this.swimmers.push(j.view);
      return false;
    });
    for (const v of this.swimmers) {
      v.update(dt, t, 0);
      this.clampInside(v);
    }
    for (const r of this.ripples) {
      const a = clamp01((t - r.t0) / RIPPLE_LIFE);
      const s = 0.35 + a * 1.3;
      r.mesh.scale.set(s, s, 1);
      r.mat.opacity = (1 - a) * 0.85;
      r.mesh.visible = a < 1;
    }
    for (const d of this.drops) {
      const a = t - d.t0;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y = d.y0 + d.vy * a - 9 * a * a;
      d.mesh.visible = d.mesh.position.y > d.y0 - 0.05 && a < 1;
    }
  }

  /** Keep every sprite of the fish (incl. swarm companions) inside the water rectangle. */
  private clampInside(v: FishView): void {
    const hw = this.water.w / 2;
    const hh = this.water.h / 2;
    for (const c of v.group.children) {
      const sx = Math.abs(c.scale.x) / 2;
      const sy = Math.abs(c.scale.y) / 2;
      c.position.x = Math.max(-hw / POOL_SCALE + sx, Math.min(hw / POOL_SCALE - sx, c.position.x));
      c.position.y = Math.max(-hh / POOL_SCALE + sy, Math.min(hh / POOL_SCALE - sy, c.position.y));
    }
  }

  private splash(at: THREE.Vector3, t: number): void {
    const mat = new THREE.MeshBasicMaterial({ map: ring(), transparent: true, depthWrite: false, opacity: 0.85 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), mat);
    mesh.position.set(at.x, at.y, this.water.z + 0.06);
    mesh.renderOrder = this.renderOrder + 2;
    this.group.add(mesh);
    this.ripples.push({ mesh, mat, t0: t });
    const dropMat = new THREE.MeshBasicMaterial({ map: dot(), color: 0xeafcff, transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const sz = 0.05 + (i % 3) * 0.015;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), dropMat);
      d.position.set(at.x, at.y, this.water.z + 0.07);
      d.renderOrder = this.renderOrder + 2;
      this.group.add(d);
      const a = (i / 5 - 0.5) * 2.2;
      this.drops.push({ mesh: d, vx: Math.sin(a) * 1.1 + ((i * 0.37) % 0.3), vy: 1.6 + ((i * 0.61) % 1) * 1.2, t0: t, y0: at.y });
    }
  }

  /** World positions of the swimming fish (debug / tests). */
  positions(): THREE.Vector3[] {
    return this.swimmers.map((v) => v.mesh.getWorldPosition(new THREE.Vector3()));
  }

  dispose(): void {
    for (const v of this.swimmers) v.dispose();
    for (const j of this.jumpers) j.view.dispose();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o.material instanceof THREE.ShaderMaterial)) (o.material as THREE.Material).dispose();
    });
    this.group.clear();
    this.jumpers = [];
    this.swimmers = [];
    this.ripples = [];
    this.drops = [];
  }
}
