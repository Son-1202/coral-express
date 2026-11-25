import * as THREE from 'three';
import { slotPlacements, type SlotSpec } from './foreFit';

/** Unit plane with its origin at the bottom centre (sprites stand on the ground). */
const FOOT = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
const POOL = 16;

export interface SpriteSlotOpts extends SlotSpec {
  line: number;
  /** How many sprite kinds this strip will hold (fixes the seeded kind choice before all have loaded). */
  count: number;
  /** World height of a sprite at scale 1 (width follows the image aspect). */
  height: number;
  /** World Y of the sprite's bottom edge. */
  baseY: number;
  /** Soft (blended) edges for the out-of-focus lens clumps; hard alpha cut-out otherwise. */
  soft: boolean;
  renderOrder?: number;
}

/**
 * T-32: seeded painted sprites along the track (lens foliage, planters). A small
 * pool of meshes is re-targeted every frame to the visible slots (no allocation
 * beyond the placement list), so the dressing is endless and stable per stretch.
 * Kinds are added as their images load; slots wait until at least one is ready.
 */
export class SpriteSlots {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly kinds: ({ mat: THREE.Material; aspect: number } | undefined)[] = [];
  private readonly loaded: { mat: THREE.Material; aspect: number }[] = [];

  constructor(private readonly o: SpriteSlotOpts) {
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(FOOT);
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = o.renderOrder ?? 0;
      this.meshes.push(m);
      this.group.add(m);
    }
  }

  /** Register one loaded sprite image (order of arrival does not matter: kinds are re-sorted by slot). */
  addKind(index: number, tex: THREE.Texture, aspect: number): void {
    const mat = this.o.soft
      ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false, fog: false })
      : new THREE.MeshBasicMaterial({ map: tex, transparent: false, alphaTest: 0.5, fog: false });
    const k = { mat, aspect };
    this.kinds[index] = k;
    this.loaded.push(k);
  }

  update(camX: number, half: number): void {
    const loaded = this.loaded;
    let used = 0;
    if (loaded.length > 0) {
      for (const p of slotPlacements(this.o.line, this.o, camX - half - 3, camX + half + 3, this.o.count)) {
        // a kind not loaded yet falls through to the next loaded one (stable once all are in)
        const kind = this.kinds[p.kind] ?? loaded[p.kind % loaded.length];
        const m = this.meshes[used];
        if (!kind || !m) break;
        used++;
        const h = this.o.height * p.scale;
        m.material = kind.mat;
        m.scale.set(h * kind.aspect * (p.flip ? -1 : 1), h, 1);
        m.position.set(p.x, this.o.baseY, p.z);
        m.visible = true;
      }
    }
    for (let i = used; i < POOL; i++) {
      const m = this.meshes[i];
      if (m) m.visible = false;
    }
  }
}
