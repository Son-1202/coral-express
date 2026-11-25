import * as THREE from 'three';
import { hasAsset, loadTexture } from '../../assets';
import { loadGameData, type GameData } from '../../data/schema';
import type { CarInfo } from '../../sim';
import type { CarView } from '../train/train';
import { fishMaterial } from '../train/fishMaterial';
import { fishSize, fishTexture } from '../train/fishView';
import { ghostHintTex, heartBubbleTex } from './paintFx';
import { ghostText, pickGhost } from './ghostPick';
import { GhostTip, type TipTarget } from './ghostTip';

interface Heart {
  mesh: THREE.Mesh;
  fishIds: string[];
  pop: number;
}
interface Ghost {
  mesh: THREE.Mesh;
  hint: THREE.Mesh;
  key: string;
  species: string;
  text: string;
  /** -1 = bottom-left corner of the window, +1 = bottom-right. */
  side: number;
}
interface CarBondFx {
  hearts: Map<string, Heart>;
  ghost: Ghost | null;
}

const HEART = 0.2;
const HINT = 0.17;
/** Ghost size caps (fraction of the window) so big species stay a small corner hint. */
const GHOST_MAX_W = 0.34;
const GHOST_MAX_H = 0.42;

/**
 * Pillar 1 readability: a heart-bubble floats between bonded partners. A bond one fish short
 * (T-27) shows ONE hint per carriage — the most valuable missing partner — as a dashed outline
 * of its real silhouette tucked in a bottom corner behind the fish, with a gold "+" hint bubble;
 * hovering / tapping it explains it ("Add a Watchman Goby to bond with Pistol Shrimp (+100%)").
 */
export class BondFx {
  private readonly perCar = new Map<string, CarBondFx>();
  private readonly heartTex: THREE.Texture;
  private readonly hintTex: THREE.Texture;
  private readonly geo = new THREE.PlaneGeometry(1, 1);
  private readonly tip: GhostTip;
  private camera: THREE.Camera | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(private readonly data: GameData = loadGameData()) {
    this.heartTex = hasAsset('icons.heart_bubble') ? loadTexture('icons.heart_bubble', () => heartBubbleTex().image as HTMLCanvasElement, { pixel: true }) : heartBubbleTex();
    this.hintTex = ghostHintTex();
    this.tip = new GhostTip((x, y) => this.ghostAt(x, y));
  }

  private heartMesh(opacity = 1): THREE.Mesh {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ map: this.heartTex, transparent: true, depthWrite: false, opacity, fog: false }));
    m.renderOrder = 7;
    m.scale.set(HEART, HEART, 1);
    return m;
  }

  /** Reconcile with the latest car info (called a few times a second). */
  sync(car: CarView, info: CarInfo): void {
    let fx = this.perCar.get(car.id);
    if (!fx) this.perCar.set(car.id, (fx = { hearts: new Map(), ghost: null }));
    const want = new Set<string>();
    for (const b of info.activeBonds) {
      const key = `${b.bondId}:${b.fishIds.join(',')}`;
      want.add(key);
      if (!fx.hearts.has(key)) {
        const mesh = this.heartMesh();
        car.fishLayer.add(mesh);
        fx.hearts.set(key, { mesh, fishIds: b.fishIds, pop: 1 });
      }
    }
    for (const [k, h] of fx.hearts) {
      if (!want.has(k)) {
        car.fishLayer.remove(h.mesh);
        (h.mesh.material as THREE.Material).dispose();
        fx.hearts.delete(k);
      }
    }
    // ghost: at most one per carriage (the most valuable bond one fish short)
    const pick = info.possibleBonds.length ? pickGhost(info.possibleBonds, this.data.bonds, this.data.config.communityBonus) : null;
    const key = pick ? `${pick.missing}|${pick.pairs.length}|${pick.communities.length}` : '';
    if (fx.ghost && fx.ghost.key !== key) {
      this.removeGhost(car, fx.ghost);
      fx.ghost = null;
    }
    if (pick && !fx.ghost) {
      const tex = fishTexture(pick.missing, false);
      const mesh = new THREE.Mesh(this.geo, fishMaterial(tex, 0, true));
      mesh.renderOrder = 6;
      const mat = mesh.material as THREE.ShaderMaterial;
      mesh.onBeforeRender = (renderer, _scene, camera) => {
        this.camera = camera;
        this.canvas = renderer.domElement;
        // outline ≥ 1 CSS px on hi-dpi screens (and exactly 1 device px on the low tier)
        if (mat.uniforms.uLinePx) mat.uniforms.uLinePx.value = renderer.getPixelRatio();
      };
      const hint = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ map: this.hintTex, transparent: true, depthWrite: false, opacity: 0.95, fog: false }));
      hint.renderOrder = 7;
      car.fishLayer.add(mesh, hint);
      // tuck it into the bottom corner away from the partner it is about
      const anchor = [...car.fish.values()].find((f) => f.species === pick.anchor);
      const side = anchor && anchor.mesh.position.x < 0 ? 1 : -1;
      fx.ghost = { mesh, hint, key, species: pick.missing, text: ghostText(pick, this.data.species), side };
    }
  }

  private removeGhost(car: CarView, g: Ghost): void {
    car.fishLayer.remove(g.mesh, g.hint);
    (g.mesh.material as THREE.Material).dispose();
    (g.hint.material as THREE.Material).dispose();
  }

  /** CSS-pixel rect of a ghost + its hint bubble (null before the first render). */
  private ghostRect(g: Ghost): TipTarget['rect'] | null {
    const cam = this.camera;
    const cv = this.canvas;
    if (!cam || !cv || !g.mesh.parent) return null;
    const r = cv.getBoundingClientRect();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const v = new THREE.Vector3();
    for (const m of [g.mesh, g.hint]) {
      for (const [cx, cy] of [[-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5]] as const) {
        v.set(cx, cy, 0).applyMatrix4(m.matrixWorld).project(cam);
        const sx = r.left + ((v.x + 1) / 2) * r.width;
        const sy = r.top + ((1 - v.y) / 2) * r.height;
        x0 = Math.min(x0, sx);
        x1 = Math.max(x1, sx);
        y0 = Math.min(y0, sy);
        y1 = Math.max(y1, sy);
      }
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private ghostAt(x: number, y: number): TipTarget | null {
    const PAD = 6;
    for (const fx of this.perCar.values()) {
      const g = fx.ghost;
      const rect = g && this.ghostRect(g);
      if (!g || !rect) continue;
      if (x >= rect.x - PAD && x <= rect.x + rect.w + PAD && y >= rect.y - PAD && y <= rect.y + rect.h + PAD) return { rect, text: g.text };
    }
    return null;
  }

  /** Screen centre (CSS px) + tooltip text of the first visible ghost — for E2E / debug. */
  ghostScreen(): { x: number; y: number; text: string } | null {
    for (const fx of this.perCar.values()) {
      const g = fx.ghost;
      const rect = g && this.ghostRect(g);
      if (g && rect) return { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.6, text: g.text };
    }
    return null;
  }

  /** Heart pop when a bond forms. */
  pop(carId: string, fishIds: string[]): void {
    const fx = this.perCar.get(carId);
    if (!fx) return;
    for (const h of fx.hearts.values()) if (h.fishIds.join() === fishIds.join()) h.pop = 0;
  }

  drop(carId: string): void {
    this.perCar.delete(carId);
  }

  update(dt: number, time: number, cars: CarView[]): void {
    this.tip.tick();
    const tmp = new THREE.Vector3();
    for (const car of cars) {
      const fx = this.perCar.get(car.id);
      if (!fx) continue;
      for (const h of fx.hearts.values()) {
        tmp.set(0, 0, 0);
        let k = 0;
        for (const id of h.fishIds) {
          const f = car.fish.get(id);
          if (!f) continue;
          tmp.add(f.mesh.position);
          k++;
        }
        if (!k) continue;
        tmp.divideScalar(k);
        h.pop = Math.min(1, h.pop + dt * 2.5);
        const s = HEART * (h.pop < 1 ? 1 + Math.sin(h.pop * Math.PI) * 0.8 : 1);
        h.mesh.scale.set(s, s, 1);
        h.mesh.position.set(tmp.x, tmp.y + 0.12 + Math.sin(time * 2.4 + tmp.x) * 0.025, 0.06);
      }
      const g = fx.ghost;
      if (g) {
        const mu = (g.mesh.material as THREE.ShaderMaterial).uniforms;
        const tex = mu.map?.value as THREE.Texture | undefined;
        const sz = tex ? fishSize(tex) : { w: 0.4, h: 0.3 };
        const k = Math.min(1, (car.winW * GHOST_MAX_W) / sz.w, (car.winH * GHOST_MAX_H) / sz.h);
        const w = sz.w * k;
        const h = sz.h * k;
        const m = 0.05;
        const gx = g.side * (car.winW / 2 - w / 2 - m);
        const gy = -car.winH / 2 + h / 2 + m + Math.sin(time * 1.3) * 0.008;
        // behind every fish (fish sit at z -0.01…0.01), in front of the tank backdrop (-0.02)
        g.mesh.position.set(gx, gy, -0.015);
        // face into the window
        g.mesh.scale.set(w * -g.side, h, 1);
        if (mu.uOpacity) mu.uOpacity.value = 0.6 + Math.sin(time * 2.2) * 0.15;
        const img = tex?.image as { width?: number; height?: number } | undefined;
        if (img?.width && mu.uTexel) (mu.uTexel.value as THREE.Vector2).set(1 / img.width, 1 / (img.height ?? img.width));
        const hs = HINT * (1 + Math.sin(time * 2.2) * 0.06);
        const hx = Math.max(-car.winW / 2 + HINT / 2, Math.min(car.winW / 2 - HINT / 2, gx + g.side * -w * 0.25));
        g.hint.position.set(hx, Math.min(car.winH / 2 - HINT / 2, gy + h / 2 + HINT * 0.45), 0.055);
        g.hint.scale.set(hs, hs, 1);
      }
    }
  }
}
