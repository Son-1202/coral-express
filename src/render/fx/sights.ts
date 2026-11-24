import * as THREE from 'three';
import { PATHS, sharedTexture } from '../../assets';
import { makeCanvas } from '../paint/canvas';
import type { Particles } from './particles';
import { confettiTex, splashTex, sparkleTex } from './paintFx';

/** Hooks the sight layer needs from the stage. */
export interface SightHost {
  /** World X the camera is looking at. */
  focusX(): number;
  /** World X + roof Y of a carriage (random-ish by index). */
  carRoof(index: number): { x: number; y: number } | null;
  /** World X of the next platform. */
  nextStationX(): number;
  zoomOut(amount: number): void;
  fog(mult: number): void;
  readonly particles: Particles;
}

function blob(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): () => HTMLCanvasElement {
  return () => {
    const p = makeCanvas(w, h);
    draw(p.ctx);
    return p.canvas;
  };
}
const paintDolphin = blob(24, 10, (c) => {
  c.fillStyle = '#6f94b4';
  c.fillRect(3, 3, 16, 5);
  c.fillRect(18, 4, 4, 2);
  c.fillRect(10, 1, 3, 2);
  c.fillRect(0, 2, 3, 2);
  c.fillRect(0, 6, 3, 2);
  c.fillStyle = '#dfeaf2';
  c.fillRect(6, 6, 11, 2);
  c.fillStyle = '#1d2b33';
  c.fillRect(17, 4, 1, 1);
});
const paintGull = blob(16, 12, (c) => {
  c.fillStyle = '#f7f7f2';
  c.fillRect(4, 4, 8, 5);
  c.fillRect(11, 2, 3, 3);
  c.fillStyle = '#9aa4ad';
  c.fillRect(2, 4, 6, 2);
  c.fillStyle = '#f2a33c';
  c.fillRect(14, 3, 2, 1);
  c.fillRect(6, 9, 1, 3);
  c.fillRect(9, 9, 1, 3);
  c.fillStyle = '#1d2b33';
  c.fillRect(12, 3, 1, 1);
});
const paintWhale = blob(64, 26, (c) => {
  c.fillStyle = '#4d6f8c';
  c.beginPath();
  c.ellipse(30, 14, 26, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.fillRect(0, 6, 8, 5);
  c.fillRect(0, 15, 8, 5);
  c.fillStyle = '#c9d8e2';
  c.fillRect(14, 18, 34, 4);
  c.fillStyle = '#1d2b33';
  c.fillRect(46, 11, 2, 2);
});

let flagTex: THREE.CanvasTexture | null = null;
function bunting(): THREE.Texture {
  if (flagTex) return flagTex;
  const p = makeCanvas(96, 12);
  const cols = ['#e45b4f', '#ffd447', '#2aa5a0', '#4c84c4', '#ff9a52', '#b98cf0'];
  p.ctx.fillStyle = '#6b4a2c';
  p.ctx.fillRect(0, 0, 96, 1);
  for (let i = 0; i < 12; i++) {
    p.ctx.fillStyle = cols[i % cols.length] ?? '#e45b4f';
    for (let y = 0; y < 9; y++) {
      const half = Math.max(0, 3.5 - y * 0.4);
      p.ctx.fillRect(i * 8 + 4 - half, 1 + y, half * 2, 1);
    }
  }
  flagTex = new THREE.CanvasTexture(p.canvas);
  flagTex.magFilter = THREE.NearestFilter;
  flagTex.minFilter = THREE.NearestFilter;
  flagTex.colorSpace = THREE.SRGBColorSpace;
  return flagTex;
}

interface Actor {
  mesh: THREE.Mesh;
  update(dt: number, t: number): boolean; // false = finished
}

/** Unit plane sized each frame from its texture aspect (art or placeholder) at height `h`. */
function spriteMesh(tex: THREE.Texture, _w: number, h: number, order = 5): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 }));
  m.renderOrder = order;
  m.userData.h = h;
  m.userData.flip = 1;
  m.userData.s = 1;
  return m;
}

function fit(m: THREE.Mesh): void {
  const h = m.userData.h as number | undefined;
  if (!h) return;
  const img = (m.material as THREE.MeshBasicMaterial).map?.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img.height ? img.width / img.height : 2;
  const s = (m.userData.s as number) ?? 1;
  m.scale.set(h * aspect * s * ((m.userData.flip as number) ?? 1), h * s, 1);
}

/** Visual side of the Sights (B4.8). Clickable actors carry `userData.sightTap`. */
export class SightFx {
  readonly group = new THREE.Group();
  /** Meshes the input layer should raycast for `tapSight`. */
  readonly tappables: THREE.Object3D[] = [];
  private actors: Actor[] = [];
  private active: string | null = null;

  constructor(private readonly host: SightHost) {}

  private add(a: Actor, tappable = false): void {
    this.group.add(a.mesh);
    this.actors.push(a);
    if (tappable) {
      a.mesh.userData.sightTap = true;
      this.tappables.push(a.mesh);
    }
  }

  get current(): string | null {
    return this.active;
  }

  start(id: string): void {
    this.clear();
    this.active = id;
    const h = this.host;
    const fx = h.focusX();
    switch (id) {
      case 'dolphin_race': {
        const tex = sharedTexture(PATHS.sight('dolphin'), paintDolphin, { pixel: true });
        for (let i = 0; i < 3; i++) {
          const m = spriteMesh(tex, 1.5, 0.95);
          let x = fx - 6 - i * 1.6;
          const ph = i * 1.3;
          this.add(
            {
              mesh: m,
              update: (dt, t) => {
                x += dt * (3.2 + Math.sin(t + ph) * 0.4) + (h.focusX() - fx) * 0;
                const cyc = (t * 0.9 + ph) % 1;
                const jump = Math.sin(cyc * Math.PI);
                m.position.set(x + (h.focusX() - fx), -1.2 + jump * 3.8, -12);
                m.rotation.z = Math.cos(cyc * Math.PI) * 0.6;
                if (cyc < 0.05) h.particles.spawn({ tex: splashTex(), x: m.position.x, y: 0.2, z: -11.8, life: 0.5, size: 0.5, sizeEnd: 0.8, aspect: 1.6, vy: 0.3 });
                return true;
              },
            },
            true,
          );
        }
        break;
      }
      case 'seagull_thief': {
        const tex = sharedTexture(PATHS.sight('gull'), paintGull, { pixel: true });
        const m = spriteMesh(tex, 0.7, 0.52, 9);
        const roof = h.carRoof(1) ?? h.carRoof(0) ?? { x: fx, y: 1.5 };
        let t0 = 0;
        this.add(
          {
            mesh: m,
            update: (dt) => {
              t0 += dt;
              const r = h.carRoof(1) ?? h.carRoof(0) ?? roof;
              const land = Math.min(1, t0 / 0.8);
              const e = 1 - (1 - land) * (1 - land);
              const peck = Math.pow(Math.max(0, Math.sin(t0 * 5)), 8) * 0.12;
              m.position.set(r.x + (1 - e) * 4, r.y + 0.24 + (1 - e) * 2.5, 0.3);
              m.rotation.z = -peck;
              m.userData.flip = -1;
              return true;
            },
          },
          true,
        );
        break;
      }
      case 'whale_breach': {
        const tex = sharedTexture(PATHS.sight('whale'), paintWhale, { pixel: true });
        const m = spriteMesh(tex, 9, 3.6, 1);
        let t0 = 0;
        const x0 = fx + 6;
        this.add({
          mesh: m,
          update: (dt) => {
            t0 += dt;
            const u = Math.min(1, t0 / 5);
            const arc = Math.sin(u * Math.PI);
            m.position.set(x0 - 6 + u * 12 + (h.focusX() - fx) * 0.6, -6 + arc * 9, -42);
            m.rotation.z = (0.5 - u) * 1.1;
            m.visible = u < 1;
            if (Math.abs(u - 0.97) < dt / 5) {
              for (let i = 0; i < 14; i++)
                h.particles.spawn({ tex: splashTex(), x: m.position.x + (Math.random() - 0.5) * 6, y: -3, z: -41, vy: 2 + Math.random() * 3, g: -4, life: 1.2, size: 1.2, sizeEnd: 2, aspect: 1.6 });
            }
            return true;
          },
        });
        h.zoomOut(1.45);
        break;
      }
      case 'festival_station': {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.25), new THREE.MeshBasicMaterial({ map: bunting(), transparent: true, alphaTest: 0.05 }));
        bunting().wrapS = THREE.RepeatWrapping;
        this.add({
          mesh: m,
          update: (_dt, t) => {
            const sx = h.nextStationX();
            m.position.set(sx, 3.1 + Math.sin(t * 1.5) * 0.04, -1.6);
            if (Math.random() < 0.15)
              h.particles.spawn({ tex: confettiTex(Math.floor(Math.random() * 6)), x: sx + (Math.random() - 0.5) * 10, y: 3.4, z: -1.2, vx: (Math.random() - 0.5) * 0.4, vy: -0.3, g: -0.3, life: 3, size: 0.07, aspect: 1.5, spin: 4, wobble: 0.15 });
            return true;
          },
        });
        break;
      }
      case 'stowaway': {
        const m = spriteMesh(splashTex(), 1.0, 0.62, 9);
        let t0 = 0;
        this.add(
          {
            mesh: m,
            update: (dt) => {
              t0 += dt;
              const r = h.carRoof(0) ?? { x: fx, y: 1.5 };
              m.position.set(r.x, r.y + 0.35 + Math.abs(Math.sin(t0 * 4)) * 0.12, 0.3);
              m.userData.s = 1 + Math.sin(t0 * 8) * 0.06;
              if (Math.random() < 0.2) h.particles.spawn({ tex: sparkleTex(), x: r.x + (Math.random() - 0.5) * 0.8, y: r.y + 0.6, z: 0.4, vy: 0.4, life: 0.6, size: 0.12, sizeEnd: 0.02 });
              return true;
            },
          },
          true,
        );
        break;
      }
      case 'sea_fog':
        h.fog(3.2);
        break;
    }
  }

  /** Sight over. `tapped` plays the reward/shoo reaction. */
  end(_id: string, tapped: boolean): void {
    const h = this.host;
    for (const a of this.actors) {
      const p = a.mesh.position.clone();
      if (tapped) h.particles.burst(sparkleTex(), p, 12, { speed: 2 });
    }
    if (this.active === 'seagull_thief' && this.actors[0]) {
      // the gull flies off (with or without loot)
      const m = this.actors[0].mesh;
      let t0 = 0;
      this.actors = [
        {
          mesh: m,
          update: (dt) => {
            t0 += dt;
            m.position.x += dt * 5;
            m.position.y += dt * 3;
            m.rotation.z = Math.sin(t0 * 20) * 0.2;
            return t0 < 1.5;
          },
        },
      ];
      this.tappables.length = 0;
      this.active = null;
      h.zoomOut(1);
      h.fog(1);
      return;
    }
    this.clear();
  }

  private clear(): void {
    for (const a of this.actors) {
      this.group.remove(a.mesh);
      (a.mesh.material as THREE.Material).dispose();
    }
    this.actors = [];
    this.tappables.length = 0;
    this.active = null;
    this.host.zoomOut(1);
    this.host.fog(1);
  }

  update(dt: number, time: number): void {
    this.actors = this.actors.filter((a) => {
      const keep = a.update(dt, time);
      fit(a.mesh);
      if (!keep) {
        this.group.remove(a.mesh);
        (a.mesh.material as THREE.Material).dispose();
      }
      return keep;
    });
  }
}
