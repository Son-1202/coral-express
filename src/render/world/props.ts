import * as THREE from 'three';
import { hasFile, sharedTexture } from '../../assets';
import { WORLD } from '../diorama/config';
import { FOOT_GEO, emptyCanvas, halfWidth, hash01, texSize } from './util';
import { swayMaterial } from './sway';

/** Render-only layout of roadside dressing (no balance). */
const PROPS = { slot: 10, chance: 0.6, zMin: -3.2, zMax: -2.75, px: 58, keepOut: 3.6 };
const FOLIAGE = { slot: 3.4, chance: 0.55, zMin: 2.2, zMax: 3.2, px: 66 };
const POOL = 24;

interface Kind {
  textures: THREE.Texture[];
  mats: THREE.Material[];
}

const propPath = (line: number, k: number) => `/scenery/l${line}_props_${k}.png`;
const foliagePath = (line: number, k: number) => `/scenery/l${line}_foliage_${k}.png`;

function kinds(line: number, path: (l: number, k: number) => string, n: number, sway: boolean): Kind {
  const textures: THREE.Texture[] = [];
  for (let k = 1; k <= n; k++) {
    const p = path(line, k);
    if (hasFile(p)) textures.push(sharedTexture(p, emptyCanvas, { pixel: true }));
  }
  const mats = textures.map((t) => (sway ? swayMaterial(t, 1.1 + (textures.indexOf(t) % 3) * 0.25, 0.05) : new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 })));
  return { textures, mats };
}

/**
 * Seeded per-slot placement: slot k (every `slot` units of world X) gets at most
 * one sprite; whether, which and where come from hash(line, k). A small pool of
 * meshes is re-targeted each frame to the visible slots, so the coast is endless.
 */
class SlotStrip {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];

  constructor(
    private readonly kind: Kind,
    private readonly o: { slot: number; chance: number; zMin: number; zMax: number; px: number; keepOut?: number; salt: number; line: number },
  ) {
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(FOOT_GEO, kind.mats[0]);
      m.visible = false;
      m.frustumCulled = false;
      this.meshes.push(m);
      this.group.add(m);
    }
  }

  update(camX: number, half: number): void {
    const { slot, chance, zMin, zMax, px, keepOut, salt, line } = this.o;
    const n = this.kind.mats.length;
    let used = 0;
    if (n > 0) {
      const k0 = Math.floor((camX - half - 4) / slot);
      const k1 = Math.ceil((camX + half + 4) / slot);
      for (let k = k0; k <= k1 && used < POOL; k++) {
        if (hash01(line, k, salt) > chance) continue;
        const x = (k + 0.15 + hash01(line, k, salt + 1) * 0.7) * slot;
        if (keepOut) {
          const sp = WORLD.stationSpacing;
          if (Math.abs(x - Math.round(x / sp) * sp) < keepOut) continue;
        }
        const idx = Math.floor(hash01(line, k, salt + 2) * n) % n;
        const tex = this.kind.textures[idx];
        const mat = this.kind.mats[idx];
        if (!tex || !mat) continue;
        const { w, h } = texSize(tex);
        if (w < 8) continue; // not loaded yet
        const m = this.meshes[used++];
        if (!m) break;
        const s = 0.85 + hash01(line, k, salt + 3) * 0.3;
        m.material = mat;
        m.scale.set((w / px) * s * (hash01(line, k, salt + 4) < 0.5 ? -1 : 1), (h / px) * s, 1);
        const z = zMin + hash01(line, k, salt + 5) * (zMax - zMin);
        m.position.set(x, this.o.zMin > 0 ? WORLD.nearGroundY - 0.02 : WORLD.groundY - 0.05, z);
        m.visible = true;
      }
    }
    for (let i = used; i < POOL; i++) {
      const m = this.meshes[i];
      if (m) m.visible = false;
    }
  }
}

/** Roadside props (verge behind the track, away from platforms) + swaying near foliage. */
export class Roadside {
  readonly group = new THREE.Group();
  private readonly strips = new Map<number, SlotStrip[]>();
  private line = 0;

  setLine(line: number): void {
    if (line === this.line) return;
    this.line = line;
    if (!this.strips.has(line)) {
      const props = new SlotStrip(kinds(line, propPath, 4, false), { ...PROPS, salt: 11, line });
      const fol = new SlotStrip(kinds(line, foliagePath, 3, true), { ...FOLIAGE, salt: 31, line });
      this.strips.set(line, [props, fol]);
      this.group.add(props.group, fol.group);
    }
    for (const [l, ss] of this.strips) for (const s of ss) s.group.visible = l === line;
  }

  update(camera: THREE.PerspectiveCamera): void {
    const half = halfWidth(camera);
    for (const s of this.strips.get(this.line) ?? []) s.update(camera.position.x, half * 1.15);
  }
}
