/** Tank View materials: fish tail-wobble, plant sway, soft points. All motion is procedural. */
import * as THREE from 'three';

const fishVert = /* glsl */ `
uniform float uTime;
uniform float uFreq;
uniform float uAmp;
uniform float uWave;
uniform float uPhase;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float ph = uPhase;
  #ifdef USE_INSTANCING
  ph += instanceMatrix[3].x * 3.1;
  #endif
  // tail wobble: strongest at the tail (uv.x = 0, sprites face right)
  float tail = (1.0 - uv.x) * (1.0 - uv.x);
  p.y += sin(uTime * uFreq + ph - uv.x * 3.0) * uAmp * tail;
  // whole-body travelling sine head->tail (sinuous / undulation / tentacles at the bottom)
  p.y += sin(uTime * uFreq * 0.7 + ph - uv.x * 6.2832) * uAmp * 0.7 * uWave * (0.3 + tail);
  p.x += sin(uTime * uFreq * 0.8 + ph + uv.x * 4.0) * uAmp * 0.5 * uWave * (1.0 - uv.y) * (1.0 - uv.y);
  vec4 wp = vec4(p, 1.0);
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * wp;
}`;

const fishFrag = /* glsl */ `
uniform sampler2D map;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uAlpha;
uniform float uFlash;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.35) discard;
  vec3 col = mix(c.rgb, uTint, uTintAmt);
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(col, uAlpha);
  #include <colorspace_fragment>
}`;

export interface FishUniforms {
  [k: string]: THREE.IUniform;
  map: THREE.IUniform<THREE.Texture>;
  uTime: THREE.IUniform<number>;
  uFreq: THREE.IUniform<number>;
  uAmp: THREE.IUniform<number>;
  uWave: THREE.IUniform<number>;
  uPhase: THREE.IUniform<number>;
  uTint: THREE.IUniform<THREE.Color>;
  uTintAmt: THREE.IUniform<number>;
  uAlpha: THREE.IUniform<number>;
  uFlash: THREE.IUniform<number>;
}

export function fishMaterial(map: THREE.Texture, phase = 0): THREE.ShaderMaterial & { uniforms: FishUniforms } {
  const uniforms: FishUniforms = {
    map: { value: map },
    uTime: { value: 0 },
    uFreq: { value: 6 },
    uAmp: { value: 0.1 },
    uWave: { value: 0 },
    uPhase: { value: phase },
    uTint: { value: new THREE.Color('#2a6f9a') },
    uTintAmt: { value: 0 },
    uAlpha: { value: 1 },
    uFlash: { value: 0 },
  };
  return new THREE.ShaderMaterial({
    vertexShader: fishVert, fragmentShader: fishFrag, uniforms, transparent: true, depthWrite: false, depthTest: false,
  }) as THREE.ShaderMaterial & { uniforms: FishUniforms };
}

// Plant sway (SPEC C): offsetX = sin(time×freq + worldX×0.7) × amp × uv.y²  (+ bend-away + slosh lean)
const plantVert = /* glsl */ `
uniform float uTime;
uniform float uFreq;
uniform float uAmp;
uniform float uBend;
uniform float uLean;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float h2 = uv.y * uv.y;
  wp.x += sin(uTime * uFreq + wp.x * 0.7) * uAmp * h2 + (uBend + uLean) * h2;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export interface PlantUniforms {
  [k: string]: THREE.IUniform;
  map: THREE.IUniform<THREE.Texture>;
  uTime: THREE.IUniform<number>;
  uFreq: THREE.IUniform<number>;
  uAmp: THREE.IUniform<number>;
  uBend: THREE.IUniform<number>;
  uLean: THREE.IUniform<number>;
  uTint: THREE.IUniform<THREE.Color>;
  uTintAmt: THREE.IUniform<number>;
  uAlpha: THREE.IUniform<number>;
  uFlash: THREE.IUniform<number>;
}

export function plantMaterial(map: THREE.Texture, freq: number, amp: number): THREE.ShaderMaterial & { uniforms: PlantUniforms } {
  const uniforms: PlantUniforms = {
    map: { value: map },
    uTime: { value: 0 },
    uFreq: { value: freq },
    uAmp: { value: amp },
    uBend: { value: 0 },
    uLean: { value: 0 },
    uTint: { value: new THREE.Color('#2a6f9a') },
    uTintAmt: { value: 0 },
    uAlpha: { value: 1 },
    uFlash: { value: 0 },
  };
  return new THREE.ShaderMaterial({
    vertexShader: plantVert, fragmentShader: fishFrag, uniforms, transparent: true, depthWrite: false, depthTest: false,
  }) as THREE.ShaderMaterial & { uniforms: PlantUniforms };
}

const pointsVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale;
}`;
const pointsFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uRing;
uniform float uStar;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  if (uStar > 0.5) {
    // 4-point sparkle: thin cross fading to the tips + bright core
    float arm = max(step(abs(d.x), 0.06), step(abs(d.y), 0.06)) * (1.0 - r * 2.0);
    float a = max(arm, step(r, 0.12));
    if (a <= 0.01) discard;
    gl_FragColor = vec4(uColor + vec3(0.25) * step(r, 0.12), a * vAlpha);
    #include <colorspace_fragment>
    return;
  }
  float a = uRing > 0.5 ? smoothstep(0.5, 0.38, r) * (0.35 + 0.65 * smoothstep(0.22, 0.42, r)) : smoothstep(0.5, 0.2, r);
  vec3 col = uColor + (uRing > 0.5 ? vec3(0.3) * step(r, 0.18) * step(0.08, -d.y) : vec3(0.0));
  gl_FragColor = vec4(col, a * vAlpha);
  #include <colorspace_fragment>
}`;

/** Dynamic point cloud (bubbles, motes, food, shiny sparkles). Positions/sizes/alphas written by the caller. */
export class PointCloud {
  readonly points: THREE.Points;
  readonly pos: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  private readonly geo = new THREE.BufferGeometry();
  readonly material: THREE.ShaderMaterial;

  constructor(readonly capacity: number, color: string, ring: boolean, star = false) {
    this.pos = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: pointsVert,
      fragmentShader: pointsFrag,
      uniforms: { uColor: { value: new THREE.Color(color) }, uRing: { value: ring ? 1 : 0 }, uStar: { value: star ? 1 : 0 }, uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
  }

  /** Call after writing pos/size/alpha. `scale` = device pixels per world unit. */
  commit(scale: number): void {
    (this.material.uniforms.uScale as THREE.IUniform<number>).value = scale;
    for (const k of ['position', 'aSize', 'aAlpha']) (this.geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}
