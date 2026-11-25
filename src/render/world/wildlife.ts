import * as THREE from 'three';
import { PATHS, hasFile, sharedTexture } from '../../assets';
import { CENTER_GEO, atDepth, emptyCanvas, halfWidth, texSize } from './util';
import type { Particles } from '../fx/particles';
import { splashTex } from '../fx/paintFx';

/**
 * Ambient wildlife (SPEC C "wildlife tween in/out"): one creature every ~20–40 s,
 * three species per Line, each with its own procedural path. Render-only.
 */
export type Behaviour = 'scuttle' | 'crawl' | 'flop' | 'float' | 'dive' | 'flap' | 'glide' | 'wade' | 'jump';

interface Spec {
  id: string;
  b: Behaviour;
  /** Pixels per world unit (sprite size). */
  px: number;
}

export const WILDLIFE: Record<number, Spec[]> = {
  1: [
    { id: 'sea_turtle', b: 'crawl', px: 72 },
    { id: 'pelican', b: 'dive', px: 70 },
    { id: 'beach_crab', b: 'scuttle', px: 95 },
  ],
  2: [
    { id: 'seal', b: 'flop', px: 68 },
    { id: 'puffin', b: 'flap', px: 80 },
    { id: 'otter', b: 'float', px: 70 },
  ],
  3: [
    { id: 'frigatebird', b: 'glide', px: 60 },
    { id: 'flamingo', b: 'wade', px: 60 },
    { id: 'manta', b: 'jump', px: 42 },
  ],
};

/** Ground walkers use the front edge of the track bed; flyers and swimmers sit behind the near art. */
const GROUND_Z = 1.05;
const SKY_Z = -10;
/**
 * Breach lane (manta): just behind the verge art, with an arc that clears the
 * L3 palms/monstera (backlog: at the old sea depth, z −14, it was hidden).
 * T-24: peak lowered (3.8 → 2.7) so the whole leap stays inside the tilt-shift sharp band.
 */
const JUMP = { z: -5.5, y0: 0.2, height: 2.7 };

interface Actor {
  spec: Spec;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  dir: 1 | -1;
  x0: number;
  y0: number;
  /** Behaviour-specific numbers. */
  a: number;
  b: number;
  splashed: number;
}

export class Wildlife {
  readonly group = new THREE.Group();
  private readonly actors: Actor[] = [];
  private line = 1;
  private timer = 7;
  private next = 0;

  constructor(private readonly particles?: Particles) {}

  setLine(line: number): void {
    if (line === this.line) return;
    this.line = line;
    for (const a of this.actors) this.kill(a);
    this.actors.length = 0;
    this.timer = 6;
  }

  get count(): number {
    return this.actors.length;
  }

  /** Spawn now (debug / screenshots). `id` must be one of the Line's species. */
  spawn(camera: THREE.PerspectiveCamera, id?: string): boolean {
    const list = WILDLIFE[this.line] ?? [];
    const spec = id ? list.find((s) => s.id === id) : list[this.next++ % list.length];
    if (!spec || !hasFile(PATHS.wildlife(spec.id))) return false;
    const tex = sharedTexture(PATHS.wildlife(spec.id), emptyCanvas, { pixel: true });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, depthWrite: true });
    const mesh = new THREE.Mesh(CENTER_GEO, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    const cam = camera.position;
    const half = halfWidth(camera);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const a: Actor = { spec, mesh, mat, age: 0, life: 14, dir, x0: 0, y0: 0, a: 0, b: 0, splashed: 0 };
    const edge = (z: number, y0: number, inset = 0) => atDepth(cam, cam.x - dir * (half + 1.2 - inset), y0, z);
    switch (spec.b) {
      case 'scuttle':
      case 'crawl':
      case 'flop':
      case 'float':
      case 'wade': {
        // the flamingo wades along the track-side edge too: the sea band is behind the L3 palms
        const p = edge(GROUND_Z, 0);
        a.x0 = p.x;
        a.y0 = 0.02;
        a.a = { scuttle: 1.9, crawl: 0.9, flop: 1.1, float: 1.3, wade: 1.0 }[spec.b];
        a.life = ((half * 2 + 3) / a.a) * 1.05;
        mesh.position.z = GROUND_Z;
        break;
      }
      case 'dive':
      case 'flap':
      case 'glide': {
        const y0 = spec.b === 'glide' ? 5.0 : spec.b === 'dive' ? 4.4 : 3.9;
        const p = edge(SKY_Z, y0);
        a.x0 = p.x;
        a.y0 = p.y;
        a.a = spec.b === 'flap' ? 5.5 : spec.b === 'glide' ? 3.2 : 4.5;
        // dive point: on screen, a little past the middle (world X at this depth)
        a.b = atDepth(cam, cam.x + dir * (Math.random() * 0.5) * half, y0, SKY_Z).x;
        a.life = spec.b === 'dive' ? 12 : ((half * 2 + 3) * ((cam.z - SKY_Z) / cam.z)) / a.a;
        mesh.position.z = SKY_Z;
        break;
      }
      case 'jump': {
        a.x0 = atDepth(cam, cam.x + (Math.random() - 0.5) * half, JUMP.y0, JUMP.z).x;
        a.y0 = JUMP.y0;
        a.a = 0;
        a.life = 3.2;
        mesh.position.z = JUMP.z;
        break;
      }
    }
    this.actors.push(a);
    this.group.add(mesh);
    return true;
  }

  private kill(a: Actor): void {
    this.group.remove(a.mesh);
    a.mat.dispose();
  }

  update(dt: number, time: number, camera: THREE.PerspectiveCamera): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 20 + Math.random() * 20;
      this.spawn(camera);
    }
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];
      if (!a) continue;
      a.age += dt;
      if (a.age >= a.life) {
        this.kill(a);
        this.actors.splice(i, 1);
        continue;
      }
      this.pose(a, time);
    }
  }

  private pose(a: Actor, time: number): void {
    const m = a.mesh;
    const { w, h } = texSize(a.mat.map as THREE.Texture);
    if (w < 8) return;
    m.visible = true;
    const sw = w / a.spec.px;
    const sh = h / a.spec.px;
    const t = a.age;
    const d = a.dir;
    let x = a.x0 + d * a.a * t;
    let y = a.y0;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let fade = Math.min(1, t / 0.6, (a.life - t) / 0.6);
    switch (a.spec.b) {
      case 'scuttle': {
        // dart-pause-dart sideways, tiny leg hops
        const cyc = (t * 0.9) % 1;
        x = a.x0 + d * a.a * (Math.floor(t * 0.9) + Math.min(1, cyc / 0.6)) / 0.9 * 0.9;
        y += Math.abs(Math.sin(time * 26)) * 0.025 * (cyc < 0.6 ? 1 : 0);
        sx = d; // crab art faces the camera: flip only for variety
        break;
      }
      case 'crawl':
        rot = Math.sin(time * 3) * 0.04;
        y += Math.abs(Math.sin(time * 3)) * 0.015;
        x = a.x0 + d * a.a * (t - Math.sin(time * 3) * 0.05);
        break;
      case 'flop': {
        // hump forward: move only on the up-beat, squash on landing
        const ph = (t * 1.6) % 1;
        x = a.x0 + d * a.a * (Math.floor(t * 1.6) + Math.min(1, ph / 0.5)) / 1.6;
        y += Math.sin(Math.min(1, ph / 0.5) * Math.PI) * 0.12;
        sy = ph > 0.5 && ph < 0.65 ? 0.85 : 1;
        sx = 1 / Math.sqrt(sy);
        break;
      }
      case 'float':
        y += Math.sin(time * 2.2) * 0.03;
        rot = Math.sin(time * 1.7) * 0.08;
        break;
      case 'flap':
        y += Math.sin(t * 2.3) * 0.35;
        sy = 0.78 + Math.abs(Math.sin(time * 14)) * 0.22;
        rot = Math.cos(t * 2.3) * 0.12 * d;
        break;
      case 'glide':
        y += Math.sin(t * 0.7) * 0.6;
        rot = Math.cos(t * 0.7) * 0.18 * d;
        break;
      case 'dive': {
        // cruise in, then fold the wings and plunge behind the near scenery (into the sea)
        const tDive = Math.max(0.5, Math.abs(a.b - a.x0) / a.a);
        if (t < tDive) {
          y += Math.sin(t * 2) * 0.15;
          sy = 0.85 + Math.abs(Math.sin(time * 6)) * 0.15;
        } else {
          const u = t - tDive;
          x = a.x0 + d * a.a * tDive + d * a.a * 0.5 * u;
          y -= u * u * 3.2;
          rot = -d * Math.min(1.25, u * 2.2);
          if (y < -3) fade = 0;
        }
        break;
      }
      case 'wade': {
        // slow high-stepping walk with a head bob
        const step = (t * 1.2) % 1;
        x = a.x0 + d * a.a * (t - Math.sin(step * Math.PI * 2) * 0.08);
        y += Math.abs(Math.sin(step * Math.PI)) * 0.06;
        rot = Math.sin(step * Math.PI * 2) * 0.03;
        break;
      }
      case 'jump': {
        // breach: arc out of the water and back, banking along the arc
        const u = t / a.life;
        const arc = Math.sin(Math.min(1, Math.max(0, (u - 0.15) / 0.7)) * Math.PI);
        x = a.x0 + d * 2.6 * u * 3;
        y = a.y0 - 0.6 + arc * JUMP.height;
        rot = d * (0.9 - Math.min(1, Math.max(0, (u - 0.15) / 0.7)) * 1.8);
        fade = u < 0.15 || u > 0.85 ? 0 : 1;
        if (this.particles && ((u > 0.15 && a.splashed === 0) || (u > 0.85 && a.splashed === 1))) {
          a.splashed++;
          for (let i = 0; i < 10; i++)
            this.particles.spawn({ tex: splashTex(), x: x + (Math.random() - 0.5) * 1.2, y: a.y0 - 0.2, z: JUMP.z + 0.1, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, g: -7, life: 0.9, size: 0.35, sizeEnd: 0.15 });
        }
        break;
      }
    }
    m.position.x = x;
    m.position.y = y + (a.mesh.position.z === GROUND_Z ? sh / 2 : 0);
    m.rotation.z = rot;
    // sprites face right: flip when walking left (crab is symmetric)
    const flip = a.spec.b === 'scuttle' ? 1 : d;
    m.scale.set(sw * sx * flip, sh * sy, 1);
    a.mat.opacity = Math.max(0, fade);
    m.visible = fade > 0.01;
  }
}
