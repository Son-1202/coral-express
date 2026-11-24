import * as THREE from 'three';
import type { MotionProfile } from '../../data/schema';
import { PATHS, hasFile, sharedTexture } from '../../assets';
import { createMover, type Mover } from '../anim/fishMotion';
import { fishMaterial, shinyTint, type FishUniforms } from './fishMaterial';
import { paintFish } from './tank';

/** World units per sprite pixel for fish (art is 64 px on the long side). */
export const FISH_UNITS_PER_PX = 0.0088;
/** Placeholder fish are tiny canvases; scale them up to a similar size. */
const PLACEHOLDER_UNITS_PER_PX = 0.026;
const SWARM_COUNT = 9;

let geo: THREE.PlaneGeometry | null = null;
function unitPlane(): THREE.PlaneGeometry {
  if (!geo) geo = new THREE.PlaneGeometry(1, 1, 6, 1);
  return geo;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function fishTexture(species: string, shiny: boolean): THREE.Texture {
  const ph = () => paintFish(hash(species) % 4);
  if (!shiny) return sharedTexture(PATHS.fish(species), ph, { pixel: true });
  // dedicated shiny art if ART made one, else a hue-tinted copy of the normal sprite
  const own = PATHS.fish(species, true);
  return hasFile(own)
    ? sharedTexture(own, ph, { pixel: true })
    : sharedTexture(PATHS.fish(species), ph, { pixel: true, transform: shinyTint });
}

/** Size of a fish sprite in world units (from the texture's pixel size). */
export function fishSize(tex: THREE.Texture): { w: number; h: number } {
  const img = tex.image as { width?: number; height?: number } | undefined;
  const w = img?.width ?? 16;
  const h = img?.height ?? 11;
  const k = w < 32 ? PLACEHOLDER_UNITS_PER_PX : FISH_UNITS_PER_PX;
  return { w: w * k, h: h * k };
}

/** One sim fish inside a tank: sprite + procedural mover (+ swarm companions). */
export class FishView {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly mover: Mover;
  readonly uniforms: FishUniforms;
  private readonly tex: THREE.Texture;
  private readonly extras: { mesh: THREE.Mesh; ox: number; oy: number; ph: number }[] = [];
  private flash = 0;
  /** >0 while dropping in after a purchase (seconds left). */
  private drop = 0;
  private depth: number;
  wiggle = 0;

  constructor(
    readonly id: string,
    readonly species: string,
    readonly shiny: boolean,
    readonly profile: MotionProfile,
    private readonly tankW: number,
    private readonly tankH: number,
  ) {
    const seed = hash(id);
    this.tex = fishTexture(species, shiny);
    const mat = fishMaterial(this.tex, (seed % 100) / 7);
    this.uniforms = mat.uniforms;
    this.mesh = new THREE.Mesh(unitPlane(), mat);
    this.mesh.userData.fishId = id;
    this.group.add(this.mesh);
    // random depth: farther = smaller, bluer (SPEC C)
    this.depth = ((seed >>> 8) % 100) / 100;
    this.uniforms.uTintAmt.value = this.depth * 0.35;
    const s = fishSize(this.tex);
    this.mover = createMover(profile, seed, { hx: s.w / 2 / tankW, hy: s.h / 2 / tankH });
    if (profile === 'swarm') {
      for (let i = 0; i < SWARM_COUNT; i++) {
        const m = new THREE.Mesh(unitPlane(), fishMaterial(this.tex, i * 1.3));
        this.group.add(m);
        this.extras.push({ mesh: m, ox: Math.sin(i * 2.4) * 0.12, oy: Math.cos(i * 1.7) * 0.1, ph: i * 0.9 });
      }
    }
  }

  /** White flash + wiggle (level-up / feeding). */
  pulse(strength = 1): void {
    this.flash = Math.max(this.flash, strength);
    this.wiggle = 1;
  }

  dropIn(): void {
    this.drop = 0.9;
  }

  /** Tank-local position of the fish centre. */
  localPos(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.mesh.position);
  }

  update(dt: number, time: number, slosh: number): void {
    const p = this.mover.update(dt, time, slosh);
    const s = fishSize(this.tex);
    const scale = 1 - this.depth * 0.22;
    let x = p.x * this.tankW;
    let y = p.y * this.tankH;
    if (this.drop > 0) {
      this.drop = Math.max(0, this.drop - dt);
      const u = 1 - this.drop / 0.9;
      y += (1 - Math.min(1, u * 1.4)) * this.tankH * 0.9;
    }
    this.wiggle = Math.max(0, this.wiggle - dt * 1.5);
    const wig = Math.sin(time * 40) * this.wiggle * 0.12;
    const turnSquash = 1 - (1 - Math.abs(p.facing)) * 0.3;
    const f = p.facing >= 0 ? Math.max(0.15, Math.abs(p.facing)) : -Math.max(0.15, Math.abs(p.facing));
    this.mesh.position.set(x, y, 0.01 - this.depth * 0.02);
    this.mesh.scale.set(s.w * scale * f * p.sx, s.h * scale * p.sy * (turnSquash + (1 - turnSquash) * 0.5), 1);
    this.mesh.rotation.z = p.rot + wig;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    const u = this.uniforms;
    u.uTime.value = time;
    u.uWobble.value = p.wobble * (1 + this.wiggle * 2);
    u.uFlash.value = this.flash;
    const img = this.tex.image as { width?: number; height?: number } | undefined;
    if (img?.width) u.uTexel.value.set(1 / img.width, 1 / (img.height ?? img.width));
    for (const e of this.extras) {
      const k = 0.55;
      e.mesh.position.set(x + (e.ox + Math.sin(time * 1.7 + e.ph) * 0.05) * this.tankW * 0.6, y + (e.oy + Math.cos(time * 2.1 + e.ph) * 0.04) * this.tankH, 0.005);
      e.mesh.scale.set(s.w * k * f, s.h * k, 1);
      const mu = (e.mesh.material as THREE.ShaderMaterial).uniforms as FishUniforms;
      mu.uTime.value = time;
      mu.uWobble.value = 12;
    }
  }

  dispose(): void {
    (this.mesh.material as THREE.Material).dispose();
    for (const e of this.extras) (e.mesh.material as THREE.Material).dispose();
  }
}
