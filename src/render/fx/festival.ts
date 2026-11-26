import * as THREE from 'three';
import { PATHS, sharedTexture } from '../../assets';
import { festivalAnchors, type FestivalAnchors } from '../diorama/station';
import { paintBuntingStrip, paintConfetti, paintFlag, paintLanternStrip } from './festivalPaint';
import type { Particles } from './particles';

/**
 * T-38 Festival Station decor: `festival/bunting` + `festival/lanterns` hung in sagging spans
 * between the platform's flag poles, the station's eaves and its name sign (station depth, inside
 * the tilt-shift's sharp band), `festival/flag` poles at both platform ends, and fluttering
 * `festival/confetti_<n>` around that platform only. Procedural fallbacks while art is missing.
 */
const LOOK = {
  bunting: { h: 0.5 },
  lanterns: { h: 0.46 },
  /** Pole column (fraction of width) and where the bunting ties on (fraction from the top). */
  flag: { h: 1.35, poleU: 0.173, tieV: 0.14 },
  /** Sag per unit of span length; the middle (eave → eave) span hangs flatter. */
  sag: { perLen: 0.075, min: 0.05, max: 0.4, middle: 0.45 },
  confetti: { pxPerUnit: 100, approachRate: 3, arriveRate: 7, arriveSeconds: 3.5, burst: 40 },
  /** Confetti only while the platform is this close to the camera focus; decor goes beyond `keep`. */
  dist: { emit: 16, keep: 30 },
} as const;

export interface Pt {
  x: number;
  y: number;
}

/** Sag depth of a span of length `len` (render layout). */
export function spanSag(len: number, scale = 1): number {
  const S = LOOK.sag;
  return Math.min(S.max, Math.max(S.min, len * S.perLen)) * scale;
}

/** `n + 1` points of a sagging cord from a to b (parabola ≈ catenary at this sag). */
export function sagPoints(a: Pt, b: Pt, sag: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - sag * 4 * u * (1 - u) });
  }
  return out;
}

/** Fraction (from the top) of the cord: centre of the first row that is ≥ 90 % opaque. */
export function cordRow(alpha: (x: number, y: number) => number, w: number, h: number): number {
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (alpha(x, y) > 128) n++;
    if (n >= w * 0.9) return (y + 0.5) / h;
  }
  return 0.1;
}

type Img = { width?: number; height?: number };
const cordCache = new WeakMap<object, number>();
function cordOf(img: Img & object): number {
  let v = cordCache.get(img);
  if (v !== undefined) return v;
  v = 0.1;
  const w = img.width ?? 0;
  const h = img.height ?? 0;
  if (w > 0 && h > 0) {
    try {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img as CanvasImageSource, 0, 0);
        const d = ctx.getImageData(0, 0, w, h).data;
        v = cordRow((x, y) => d[(y * w + x) * 4 + 3] ?? 0, w, h);
      }
    } catch {
      /* keep the default */
    }
  }
  cordCache.set(img, v);
  return v;
}

function tex(name: string, paint: () => HTMLCanvasElement, wrap = false): THREE.Texture {
  const t = sharedTexture(PATHS.festival(name), paint, { pixel: true });
  if (wrap) t.wrapS = THREE.RepeatWrapping;
  return t;
}

const confettiTexes = (): THREE.Texture[] => Array.from({ length: 8 }, (_, i) => tex(`confetti_${i + 1}`, () => paintConfetti(i)));

function cutout(map: THREE.Texture): THREE.MeshBasicMaterial {
  // opaque pass + alpha cut-out (like the station art): depth-tested, never sorted over the train
  return new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
}

/** One sagging strip of a tileable garland; pennants hang straight down and sway at the tips. */
class Span {
  readonly mesh: THREE.Mesh;
  private readonly geo = new THREE.BufferGeometry();
  private pts: Pt[] = [];
  private zs: number[] = [];
  private img: unknown = null;
  private cord = 0.1;

  constructor(
    private readonly tex: THREE.Texture,
    private readonly h: number,
    private readonly phase: number,
  ) {
    this.mesh = new THREE.Mesh(this.geo, cutout(tex));
    this.mesh.frustumCulled = false;
  }

  /** (Re)build along a → b with depth lerped between the two anchors. */
  build(a: THREE.Vector3, b: THREE.Vector3, sagScale: number): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(8, Math.ceil(len / 0.08));
    this.pts = sagPoints(a, b, spanSag(len, sagScale), n);
    this.zs = this.pts.map((_, i) => a.z + ((b.z - a.z) * i) / n);
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((n + 1) * 4), 2));
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = i * 2;
      idx.push(t0, t0 + 1, t0 + 2, t0 + 2, t0 + 1, t0 + 3);
    }
    this.geo.setIndex(idx);
    this.img = null; // re-measure UVs
  }

  /** UVs follow the cord's arc length, so the art tiles at its own aspect (no texture.repeat). */
  private uvs(): void {
    const img = this.tex.image as (Img & object) | undefined;
    if (!img || img === this.img) return;
    this.img = img;
    this.cord = cordOf(img);
    const tileW = this.h * ((img.width ?? 1) / (img.height ?? 1));
    const uv = this.geo.getAttribute('uv') as THREE.BufferAttribute;
    let s = 0;
    this.pts.forEach((p, i) => {
      if (i > 0) {
        const q = this.pts[i - 1] as Pt;
        s += Math.hypot(p.x - q.x, p.y - q.y);
      }
      uv.setXY(i * 2, s / tileW, 1);
      uv.setXY(i * 2 + 1, s / tileW, 0);
    });
    uv.needsUpdate = true;
  }

  update(t: number): void {
    if (!this.pts.length) return;
    this.uvs();
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const n = this.pts.length - 1;
    const top = this.cord * this.h;
    this.pts.forEach((p, i) => {
      const u = i / n;
      const bob = Math.sin(t * 1.3 + this.phase) * 0.018 * 4 * u * (1 - u);
      const y = p.y + bob + top;
      const sway = Math.sin(t * 2.1 + p.x * 2.6 + this.phase) * 0.035;
      const z = this.zs[i] ?? 0;
      pos.setXYZ(i * 2, p.x, y, z);
      pos.setXYZ(i * 2 + 1, p.x + sway, y - this.h, z);
    });
    pos.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** A flag pole whose pennant ripples (vertex wave away from the pole). */
class Flag {
  readonly mesh: THREE.Mesh;
  private readonly geo = new THREE.PlaneGeometry(1, 1, 10, 1);
  private readonly rest: Float32Array;
  private base = new THREE.Vector3();

  constructor(
    private readonly tex: THREE.Texture,
    private readonly phase: number,
  ) {
    this.mesh = new THREE.Mesh(this.geo, cutout(tex));
    this.rest = Float32Array.from(this.geo.getAttribute('position').array as ArrayLike<number>);
  }

  place(base: THREE.Vector3): void {
    this.base = base.clone();
  }

  private size(): { w: number; h: number } {
    const img = this.tex.image as Img | undefined;
    const h = LOOK.flag.h;
    return { w: h * ((img?.width ?? 3) / (img?.height ?? 4)), h };
  }

  /** Where the bunting ties onto the pole (local to the platform). */
  tie(): THREE.Vector3 {
    const { h } = this.size();
    return new THREE.Vector3(this.base.x, this.base.y + h * (1 - LOOK.flag.tieV), this.base.z);
  }

  update(t: number): void {
    const { w, h } = this.size();
    const F = LOOK.flag;
    this.mesh.scale.set(w, h, 1);
    this.mesh.position.set(this.base.x + (0.5 - F.poleU) * w, this.base.y + h / 2, this.base.z);
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const lx = this.rest[i * 3] ?? 0;
      const d = Math.max(0, lx + 0.5 - F.poleU - 0.05);
      pos.setY(i, (this.rest[i * 3 + 1] ?? 0) + Math.sin(t * 3.4 - d * 7 + this.phase) * 0.03 * d);
    }
    pos.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** The whole festival dressing of one platform at world x `stationX`. */
export class FestivalDecor {
  readonly group = new THREE.Group();
  private readonly spans: Span[];
  private readonly flags: Flag[];
  private readonly confetti = confettiTexes();
  private sig = '';
  private arriveLeft = 0;
  private emitAcc = 0;

  constructor(
    readonly stationX: number,
    private readonly particles: Particles,
  ) {
    const bunting = tex('bunting', paintBuntingStrip, true);
    const lanterns = tex('lanterns', paintLanternStrip, true);
    const flag = tex('flag', paintFlag);
    this.flags = [new Flag(flag, 0), new Flag(flag, 1.7)];
    this.spans = [new Span(bunting, LOOK.bunting.h, 0), new Span(lanterns, LOOK.lanterns.h, 2.1), new Span(bunting, LOOK.bunting.h, 4.2)];
    for (const o of [...this.flags, ...this.spans]) this.group.add(o.mesh);
    this.group.position.x = stationX;
    this.group.visible = false;
  }

  /** Re-hang the spans when the platform layout (Line art, station width) changes. */
  private layout(a: FestivalAnchors): void {
    const [fl, fr] = this.flags as [Flag, Flag];
    fl.place(a.flagL);
    fr.place(a.flagR);
    const tie = fl.tie(); // depends on the flag art's aspect (placeholder → art)
    const sig = [tie, a.eaveL, a.eaveR, a.sign].map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    const [s0, s1, s2] = this.spans as [Span, Span, Span];
    s0.build(tie, a.eaveL, 1);
    s1.build(a.eaveL, a.eaveR, LOOK.sag.middle);
    s2.build(a.eaveR, a.sign, 1);
  }

  /** The train has pulled in: a confetti pop from the poles and eaves, then a short shower. */
  arrive(): void {
    this.arriveLeft = LOOK.confetti.arriveSeconds;
    const a = festivalAnchors();
    if (!a) return;
    const from = [this.flags[0]?.tie() ?? a.flagL, a.eaveL, a.eaveR, this.flags[1]?.tie() ?? a.flagR];
    for (let i = 0; i < LOOK.confetti.burst; i++) {
      const p = from[i % from.length] as THREE.Vector3;
      this.spawn(this.stationX + p.x, p.y + 0.1, (Math.random() - 0.5) * 3, 2 + Math.random() * 2.2);
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number): void {
    const t = this.confetti[Math.floor(Math.random() * this.confetti.length)] as THREE.Texture;
    const img = t.image as Img | undefined;
    const ih = img?.height ?? 3;
    const iw = img?.width ?? 4;
    const size = ih > 6 ? ih / LOOK.confetti.pxPerUnit : 0.08;
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.particles.spawn({
      tex: t, x, y, z: -1.3 + Math.random() * 1.9, vx, vy, g: -2.2, drag: 1.7, life: 3.6 + Math.random() * 1.2,
      size, aspect: iw / ih, spin: dir * (1.5 + Math.random() * 3), wobble: 0.1 + Math.random() * 0.12, flip: 3 + Math.random() * 4,
    });
  }

  /** @returns false once the platform is far behind (or ahead) of the camera and the decor can go. */
  update(dt: number, t: number, focusX: number, active: boolean): boolean {
    const dist = Math.abs(this.stationX - focusX);
    if (!active && dist > LOOK.dist.keep) return false;
    const a = festivalAnchors();
    this.group.visible = !!a && dist < LOOK.dist.keep + 12;
    if (!a || !this.group.visible) return true;
    this.layout(a);
    for (const f of this.flags) f.update(t);
    for (const s of this.spans) s.update(t);
    // confetti: a light fall while the train approaches, a shower just after it arrives
    const C = LOOK.confetti;
    this.arriveLeft = Math.max(0, this.arriveLeft - dt);
    const rate = this.arriveLeft > 0 ? C.arriveRate : active && dist < LOOK.dist.emit ? C.approachRate : 0;
    this.emitAcc += rate * dt;
    while (this.emitAcc >= 1) {
      this.emitAcc -= 1;
      this.spawn(this.stationX + (Math.random() - 0.5) * 13, 3.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, -0.2);
    }
    return true;
  }

  dispose(): void {
    for (const o of [...this.flags, ...this.spans]) o.dispose();
    this.group.removeFromParent();
  }
}
