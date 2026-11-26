import * as THREE from 'three';

/**
 * T-40: a strip of open water that slides up over the foreground band while the Dolphin Race
 * is on, so the dolphins leap from (and splash onto) visible water on every Line instead of
 * popping out of the town or the grass. Camera-relative: it sits just in front of the near
 * foreground layers, its waterline is held at a fixed screen height, and it is shaded in world
 * space (and much wider than the view) so the one-frame camera lag never shows an edge.
 */

/** Z of the water plane (in front of LAYER_Z.nearFront 7.5, behind the camera at ~23). */
export const STRIP_Z = 8.6;
/** Waterline height in NDC (−1 = bottom of the screen): low enough to clear the train's glass. */
const WATERLINE_NDC = -0.64;
/** World units per "pixel" of the water shading (chunky, matches the pixel-art scale up close). */
const WATER_PX = 1 / 40;
const RISE_S = 0.9;

/** Per-Line water: L1 Sunny Coast sea, L2 Fog Fjords fjord water, L3 Volcano Isles lagoon. */
export const STRIP_WATER: Record<number, { shallow: string; deep: string; foam: string }> = {
  1: { shallow: '#3fc0c4', deep: '#1d7f9a', foam: '#e9fbf4' },
  2: { shallow: '#5d8a8c', deep: '#2b4a55', foam: '#dfeceb' },
  3: { shallow: '#36c2ae', deep: '#13707a', foam: '#f0fff6' },
};

const vert = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform float uTime;
uniform float uTop;
uniform float uPx;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
varying vec3 vW;
float edgeAt(float x) {
  return sin(x * 1.3 + uTime * 1.6) * 0.035 + sin(x * 3.7 - uTime * 2.4) * 0.015;
}
void main() {
  vec2 p = floor(vW.xy / uPx) * uPx;
  float d = uTop - p.y;
  float e = edgeAt(p.x);
  if (d < e) discard;
  float k = d - e;
  vec3 col = mix(uShallow, uDeep, smoothstep(0.05, 1.4, k));
  // drifting wave dashes, denser near the top
  float w = sin(p.x * 2.1 + sin(p.y * 6.0) * 1.4 + uTime * 1.1 + p.y * 11.0);
  col = mix(col, uFoam, step(0.94, w) * (1.0 - smoothstep(0.1, 1.2, k)) * 0.55);
  // foam crest: a bright band and a softer under-band
  col = mix(col, uFoam, step(k, 0.05));
  col = mix(col, mix(uShallow, uFoam, 0.45), step(0.05, k) * step(k, 0.09));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const ray = new THREE.Vector3();

/** World Y where the screen row `ndcY` meets the plane z = `z` (camera matrices from the last render). */
export function worldYAtNdc(cam: THREE.Camera, ndcY: number, z: number): number {
  ray.set(0, ndcY, 0.5).unproject(cam).sub(cam.position);
  if (Math.abs(ray.z) < 1e-6) return cam.position.y;
  return cam.position.y + (ray.y * (z - cam.position.z)) / ray.z;
}

export class SeaStrip {
  readonly mesh: THREE.Mesh;
  private readonly u = {
    uTime: { value: 0 },
    uTop: { value: -100 },
    uPx: { value: WATER_PX },
    uShallow: { value: new THREE.Color() },
    uDeep: { value: new THREE.Color() },
    uFoam: { value: new THREE.Color() },
  };
  /** 0 = below the screen, 1 = fully risen. */
  private rise = 0;
  private want = false;
  private line = 0;
  /** World Y of the (risen or rising) waterline this frame. */
  waterY = -100;

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 8), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: this.u }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    this.setLine(1);
  }

  setLine(line: number): void {
    if (line === this.line) return;
    this.line = line;
    const c = STRIP_WATER[line] ?? STRIP_WATER[1];
    if (!c) return;
    this.u.uShallow.value.set(c.shallow);
    this.u.uDeep.value.set(c.deep);
    this.u.uFoam.value.set(c.foam);
  }

  show(on: boolean): void {
    this.want = on;
  }

  /** Fully up (dolphins may leap). */
  get ready(): boolean {
    return this.want && this.rise > 0.85;
  }

  update(dt: number, time: number, cam: THREE.Camera, focusX: number): void {
    this.rise = Math.max(0, Math.min(1, this.rise + (this.want ? dt : -dt) / RISE_S));
    this.mesh.visible = this.rise > 0;
    if (!this.mesh.visible) return;
    const e = this.rise * this.rise * (3 - 2 * this.rise);
    const top = worldYAtNdc(cam, WATERLINE_NDC, STRIP_Z);
    const bottom = worldYAtNdc(cam, -1.05, STRIP_Z) - 0.2;
    this.waterY = bottom + (top - bottom) * e;
    this.u.uTop.value = this.waterY;
    this.u.uTime.value = time;
    this.mesh.position.set(focusX, this.waterY - 4 + 0.1, STRIP_Z);
  }
}
