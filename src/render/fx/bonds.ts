import * as THREE from 'three';
import { hasAsset, loadTexture } from '../../assets';
import type { CarInfo } from '../../sim';
import type { CarView } from '../train/train';
import { fishMaterial } from '../train/fishMaterial';
import { fishSize, fishTexture } from '../train/fishView';
import { heartBubbleTex } from './paintFx';

interface Heart {
  mesh: THREE.Mesh;
  fishIds: string[];
  pop: number;
}
interface Ghost {
  mesh: THREE.Mesh;
  heart: THREE.Mesh;
  anchor: string;
  species: string;
}
interface CarBondFx {
  hearts: Map<string, Heart>;
  ghosts: Map<string, Ghost>;
}

const HEART = 0.2;

/**
 * Pillar 1 readability: a heart-bubble floats between bonded partners; a pair one
 * fish short shows the dotted outline of the missing partner next to the lonely fish.
 */
export class BondFx {
  private readonly perCar = new Map<string, CarBondFx>();
  private readonly heartTex: THREE.Texture;
  private readonly geo = new THREE.PlaneGeometry(1, 1);

  constructor() {
    this.heartTex = hasAsset('icons.heart_bubble') ? loadTexture('icons.heart_bubble', () => heartBubbleTex().image as HTMLCanvasElement, { pixel: true }) : heartBubbleTex();
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
    if (!fx) this.perCar.set(car.id, (fx = { hearts: new Map(), ghosts: new Map() }));
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
    // ghosts: for each possible pair, one missing partner next to a present fish of the bond
    const wantG = new Set<string>();
    let n = 0;
    for (const pb of info.possibleBonds) {
      if (n >= 2) break;
      const missing = pb.missing[0];
      const presentSp = pb.present[0];
      if (!missing || !presentSp) continue;
      const anchor = [...car.fish.values()].find((f) => f.species === presentSp);
      if (!anchor) continue;
      const key = `${pb.bondId}:${missing}`;
      wantG.add(key);
      n++;
      if (!fx.ghosts.has(key)) {
        const tex = fishTexture(missing, false);
        const mesh = new THREE.Mesh(this.geo, fishMaterial(tex, 0, true));
        mesh.renderOrder = 6;
        const heart = this.heartMesh(0.45);
        car.fishLayer.add(mesh, heart);
        fx.ghosts.set(key, { mesh, heart, anchor: anchor.id, species: missing });
      }
    }
    for (const [k, g] of fx.ghosts) {
      if (!wantG.has(k) || !car.fish.has(g.anchor)) {
        car.fishLayer.remove(g.mesh, g.heart);
        (g.mesh.material as THREE.Material).dispose();
        (g.heart.material as THREE.Material).dispose();
        fx.ghosts.delete(k);
      }
    }
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
      for (const g of fx.ghosts.values()) {
        const a = car.fish.get(g.anchor);
        if (!a) continue;
        const sz = fishSize((g.mesh.material as THREE.ShaderMaterial).uniforms.map?.value as THREE.Texture);
        const side = a.mesh.position.x > 0 ? -1 : 1;
        const gx = a.mesh.position.x + side * (0.32 + sz.w * 0.3);
        const gy = Math.max(-car.winH / 2 + sz.h / 2, Math.min(car.winH / 2 - sz.h / 2, a.mesh.position.y + 0.04));
        g.mesh.position.set(gx, gy, 0.05);
        g.mesh.scale.set(sz.w * -side, sz.h, 1);
        const mu = (g.mesh.material as THREE.ShaderMaterial).uniforms;
        if (mu.uOpacity) mu.uOpacity.value = 0.55 + Math.sin(time * 3) * 0.25;
        const img = (mu.map?.value as THREE.Texture | undefined)?.image as { width?: number; height?: number } | undefined;
        if (img?.width && mu.uTexel) (mu.uTexel.value as THREE.Vector2).set(1 / img.width, 1 / (img.height ?? img.width));
        g.heart.position.set((gx + a.mesh.position.x) / 2, Math.max(gy, a.mesh.position.y) + 0.12, 0.06);
      }
    }
  }
}
