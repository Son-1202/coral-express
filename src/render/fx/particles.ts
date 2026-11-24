import * as THREE from 'three';

export interface ParticleSpec {
  tex: THREE.Texture;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  /** Gravity (units/s², negative = falls). */
  g?: number;
  drag?: number;
  life: number;
  /** Size in world units (start → end). */
  size: number;
  sizeEnd?: number;
  /** Aspect (w/h) of the texture. */
  aspect?: number;
  spin?: number;
  color?: THREE.ColorRepresentation;
  additive?: boolean;
  /** Fade in over this fraction of the life. */
  fadeIn?: number;
  /** Wobble sideways (bubbles). */
  wobble?: number;
}

interface P extends Required<Omit<ParticleSpec, 'color' | 'tex' | 'additive'>> {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  alive: boolean;
  seed: number;
}

/** Pooled world-space sprite particles (all VFX bursts). */
export class Particles {
  readonly group = new THREE.Group();
  private readonly pool: P[] = [];
  private next = 0;

  constructor(size = 260) {
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.pool.push({
        mesh, mat, age: 0, alive: false, seed: i * 1.37, x: 0, y: 0, z: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 1,
        size: 1, sizeEnd: 1, aspect: 1, spin: 0, fadeIn: 0, wobble: 0,
      });
    }
  }

  spawn(s: ParticleSpec): void {
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    if (!p) return;
    p.mat.map = s.tex;
    p.mat.color.set(s.color ?? '#ffffff');
    p.mat.blending = s.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.mat.needsUpdate = true;
    Object.assign(p, {
      x: s.x, y: s.y, z: s.z, vx: s.vx ?? 0, vy: s.vy ?? 0, g: s.g ?? 0, drag: s.drag ?? 0, life: s.life,
      size: s.size, sizeEnd: s.sizeEnd ?? s.size, aspect: s.aspect ?? 1, spin: s.spin ?? 0, fadeIn: s.fadeIn ?? 0,
      wobble: s.wobble ?? 0, age: 0, alive: true,
    });
    p.mesh.rotation.z = 0;
    p.mesh.visible = true;
  }

  /** Radial burst helper. */
  burst(tex: THREE.Texture, at: THREE.Vector3, n: number, o: Partial<ParticleSpec> & { speed?: number } = {}): void {
    const speed = o.speed ?? 1.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const v = speed * (0.5 + Math.random() * 0.7);
      this.spawn({
        tex, x: at.x, y: at.y, z: at.z + 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v + speed * 0.3, g: -2.5,
        drag: 2, life: 0.8 + Math.random() * 0.5, size: 0.12, sizeEnd: 0.04, spin: (Math.random() - 0.5) * 6, ...o,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.alive = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy += p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const wob = p.wobble ? Math.sin(p.age * 6 + p.seed) * p.wobble : 0;
      p.mesh.position.set(p.x + wob, p.y, p.z);
      const s = p.size + (p.sizeEnd - p.size) * k;
      p.mesh.scale.set(s * p.aspect, s, 1);
      p.mesh.rotation.z += p.spin * dt;
      const fin = p.fadeIn > 0 ? Math.min(1, k / p.fadeIn) : 1;
      p.mat.opacity = fin * Math.min(1, (1 - k) * 3);
    }
  }
}
