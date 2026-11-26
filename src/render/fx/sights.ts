import * as THREE from 'three';
import { PATHS, sharedTexture } from '../../assets';
import type { Particles } from './particles';
import { FestivalDecor } from './festival';
import { splashTex, sparkleTex, bubbleTex } from './paintFx';
import { paintDolphin, paintGull, paintWhale, tapRingTex } from './sightPaint';

/** A carriage's window box in world space. */
export interface CarBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hooks the sight layer needs from the stage. */
export interface SightHost {
  /** World X the camera is looking at. */
  focusX(): number;
  /** World X + roof Y of a carriage (random-ish by index). */
  carRoof(index: number): { x: number; y: number } | null;
  /** Window box of carriage `index` (null when there is none). */
  carBox(index: number): CarBox | null;
  /** Index of the carriage a stowaway would jump into (first with a free slot). */
  stowawayCar(): number;
  /** World X range of the whole train and its roof Y. */
  trainSpan(): { x0: number; x1: number; roof: number };
  /** World X of the next platform. */
  nextStationX(): number;
  zoomOut(amount: number): void;
  fog(mult: number): void;
  readonly particles: Particles;
}

/**
 * Render-only Sight staging (QA bug 3). Depths sit in front of the mid layer and
 * behind the verge, so animals rise from "the sea beyond the fence" at readable size.
 */
const STAGE = {
  dolphin: { z: -4.4, h: 1.3, apex: 3.6, period: 1.7 },
  whale: { z: -14, h: 4.4, apex: 9.8, breach: 3.4, period: 6.5, zoom: 1.3 },
  gull: { h: 0.78 },
} as const;

interface Actor {
  mesh: THREE.Mesh;
  /** Invisible, larger tap target that follows the mesh (optional). */
  hit?: THREE.Mesh;
  update(dt: number, t: number): boolean; // false = finished
}

/** Unit plane sized each frame from its texture aspect (art or placeholder) at height `h`. */
function spriteMesh(tex: THREE.Texture, h: number, order = 5): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 }));
  m.renderOrder = order;
  m.userData.h = h;
  m.userData.flip = 1;
  m.userData.s = 1;
  return m;
}

function hitMesh(w: number, h: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  m.renderOrder = -20;
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
  /** Festival Station dressings; each outlives its sight (it ends on arrival) until its platform scrolls away. */
  private fests: FestivalDecor[] = [];

  constructor(private readonly host: SightHost) {}

  private add(a: Actor, tappable = false): void {
    this.group.add(a.mesh);
    if (a.hit) this.group.add(a.hit);
    this.actors.push(a);
    if (tappable) {
      const t = a.hit ?? a.mesh;
      t.userData.sightTap = true;
      this.tappables.push(t);
    }
  }

  get current(): string | null {
    return this.active;
  }

  private splash(x: number, y: number, z: number, n: number, size: number): void {
    for (let i = 0; i < n; i++)
      this.host.particles.spawn({ tex: splashTex(), x: x + (Math.random() - 0.5) * size, y, z, vx: (Math.random() - 0.5) * size, vy: 1.5 + Math.random() * 2.5 * size, g: -6, life: 0.9, size: 0.35 * size, sizeEnd: 0.6 * size, aspect: 1.6 });
  }

  private dolphins(): void {
    const h = this.host;
    const D = STAGE.dolphin;
    const tex = sharedTexture(PATHS.sight('dolphin'), paintDolphin, { pixel: true });
    for (let i = 0; i < 3; i++) {
      const m = spriteMesh(tex, D.h, 6);
      const hit = hitMesh(2.4, 2.2);
      const ph = i / 3;
      let lastCyc = 1;
      this.add(
        {
          mesh: m,
          hit,
          update: (_dt, t) => {
            const cyc = (t / D.period + ph) % 1;
            const jump = Math.sin(cyc * Math.PI);
            // the pod races the train: a slow surge around the camera focus
            const x = h.focusX() - 4.2 + i * 2.6 + Math.sin(t * 0.7 + i) * 0.6 + cyc * 1.2;
            m.position.set(x, -1.1 + jump * D.apex, D.z);
            m.rotation.z = 0.35 - cyc * 1.5;
            hit.position.set(x, Math.max(0.6, m.position.y), D.z + 0.05);
            if (cyc < lastCyc) this.splash(x - 0.3, 0.1, D.z + 0.2, 5, 0.8);
            if (cyc > 0.9 && lastCyc <= 0.9) this.splash(x + 0.5, 0.1, D.z + 0.2, 5, 0.8);
            lastCyc = cyc;
            return true;
          },
        },
        true,
      );
    }
  }

  private whale(): void {
    const h = this.host;
    const W = STAGE.whale;
    const tex = sharedTexture(PATHS.sight('whale'), paintWhale, { pixel: true });
    const m = spriteMesh(tex, W.h, 4);
    let t0 = 0;
    let lastU = 0;
    this.add({
      mesh: m,
      update: (dt) => {
        t0 += dt;
        const k = Math.floor(t0 / W.period);
        const local = t0 - k * W.period;
        const u = Math.min(1, local / W.breach);
        const arc = Math.sin(u * Math.PI);
        const side = k % 2 === 0 ? -1 : 1;
        const x = h.focusX() + side * 2.5 + (u - 0.5) * 7;
        m.position.set(x, -4.6 + arc * W.apex, W.z);
        m.rotation.z = 0.25 - u * 1.3;
        m.visible = u < 1;
        if (u > 0.04 && lastU <= 0.04) this.splash(x - 1, 0.3, W.z + 0.5, 14, 2.2);
        if (u > 0.92 && lastU <= 0.92) this.splash(x + 1.5, 0.3, W.z + 0.5, 22, 2.8);
        // blow-hole spout at the top of the arc
        if (arc > 0.9 && Math.random() < 0.5)
          h.particles.spawn({ tex: splashTex(), x: x + 1.2, y: m.position.y + W.h * 0.45, z: W.z + 0.3, vy: 2.5, g: -3, life: 0.7, size: 0.5, sizeEnd: 1, aspect: 1.6 });
        lastU = u >= 1 ? 0 : u;
        return true;
      },
    });
    h.zoomOut(W.zoom);
  }

  private gull(): void {
    const h = this.host;
    const tex = sharedTexture(PATHS.sight('gull'), paintGull, { pixel: true });
    const m = spriteMesh(tex, STAGE.gull.h, 9);
    const hit = hitMesh(1.4, 1.4);
    const fx = h.focusX();
    let t0 = 0;
    this.add(
      {
        mesh: m,
        hit,
        update: (dt) => {
          t0 += dt;
          const r = h.carRoof(1) ?? h.carRoof(0) ?? { x: fx, y: 1.5 };
          const land = Math.min(1, t0 / 0.8);
          const e = 1 - (1 - land) * (1 - land);
          const peck = Math.pow(Math.max(0, Math.sin(t0 * 5)), 8) * 0.12;
          m.position.set(r.x + (1 - e) * 4, r.y + STAGE.gull.h / 2 - 0.05 + (1 - e) * 2.5, 0.3);
          m.rotation.z = -peck;
          m.userData.flip = -1;
          hit.position.set(m.position.x, m.position.y, 0.35);
          return true;
        },
      },
      true,
    );
  }

  /** T-38: decor hangs at the platform the festival is for (latched now: the pose can run a sub-tick ahead). */
  private festival(): void {
    const d = new FestivalDecor(this.host.nextStationX(), this.host.particles);
    this.fests.push(d);
    this.group.add(d.group);
  }

  private stowaway(): void {
    const h = this.host;
    const idx = h.stowawayCar();
    const ring = spriteMesh(tapRingTex(), 1, 8);
    let t0 = 0;
    this.add(
      {
        mesh: ring,
        update: (dt) => {
          t0 += dt;
          const b = h.carBox(idx) ?? { x: h.focusX(), y: 1, w: 2, h: 1 };
          ring.userData.h = Math.max(b.h * 1.5, (b.w * 1.12) / 1.5); // ring art is 3:2
          ring.userData.s = 1 + Math.sin(t0 * 6) * 0.06;
          ring.position.set(b.x, b.y + 0.2, 0.6);
          // T-38: the splash out of the roof hatch is a pulsing particle fountain (was a stiff painted cone)
          const r = h.carRoof(idx) ?? { x: b.x, y: b.y + b.h };
          const pulse = 0.6 + Math.abs(Math.sin(t0 * 4)) * 0.4;
          if (Math.random() < dt * 26 * pulse)
            h.particles.spawn({ tex: splashTex(), x: b.x + (Math.random() - 0.5) * 0.3, y: r.y + 0.05, z: 0.55, vx: (Math.random() - 0.5) * 1.4, vy: 2.6 + Math.random() * 1.4 * pulse, g: -7, life: 0.75, size: 0.16, sizeEnd: 0.24, aspect: 1.6 });
          if (Math.random() < dt * 10)
            h.particles.spawn({ tex: Math.random() < 0.5 ? sparkleTex() : bubbleTex(), x: b.x + (Math.random() - 0.5) * 1.2, y: r.y + 0.6, z: 0.6, vy: 0.6, life: 0.7, size: 0.12, sizeEnd: 0.03 });
          return true;
        },
      },
      true,
    );
  }

  start(id: string): void {
    this.clear();
    this.active = id;
    switch (id) {
      case 'dolphin_race':
        this.dolphins();
        break;
      case 'seagull_thief':
        this.gull();
        break;
      case 'whale_breach':
        this.whale();
        break;
      case 'festival_station':
        this.festival();
        break;
      case 'stowaway':
        this.stowaway();
        break;
      case 'sea_fog':
        this.host.fog(3.2);
        break;
    }
  }

  /** Sight over: every visual goes (QA bug 13). `tapped` plays the reward/shoo reaction. */
  end(_id: string, tapped: boolean): void {
    const h = this.host;
    if (tapped) for (const a of this.actors) h.particles.burst(sparkleTex(), a.mesh.position.clone(), 12, { speed: 2 });
    const gull = this.active === 'seagull_thief' ? this.actors[0]?.mesh : undefined;
    const fest = this.active === 'festival_station';
    this.clear(gull);
    if (fest) this.fests[this.fests.length - 1]?.arrive();
    if (!gull) return;
    // the gull flies off (with or without loot), then is gone
    let t0 = 0;
    this.group.add(gull);
    this.actors = [
      {
        mesh: gull,
        update: (dt) => {
          t0 += dt;
          gull.position.x += dt * 6;
          gull.position.y += dt * 3.5;
          gull.rotation.z = Math.sin(t0 * 20) * 0.2;
          return t0 < 1.2;
        },
      },
    ];
  }

  /**
   * Remove every actor (except `keep`), reset zoom + fog. The festival decor is not an actor: it stays
   * even when another sight starts at the arrival tick, and goes by distance in `update()`.
   */
  private clear(keep?: THREE.Mesh): void {
    for (const a of this.actors) {
      this.group.remove(a.mesh);
      if (a.hit) {
        this.group.remove(a.hit);
        (a.hit.material as THREE.Material).dispose();
      }
      if (a.mesh !== keep) (a.mesh.material as THREE.Material).dispose();
    }
    this.actors = [];
    this.tappables.length = 0;
    this.active = null;
    this.host.zoomOut(1);
    this.host.fog(1);
  }

  update(dt: number, time: number): void {
    const last = this.fests[this.fests.length - 1];
    this.fests = this.fests.filter((d) => {
      const keep = d.update(dt, time, this.host.focusX(), d === last && this.active === 'festival_station');
      if (!keep) d.dispose();
      return keep;
    });
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
