import * as THREE from 'three';

const vert = /* glsl */ `
uniform float uTime;
uniform float uWobble;
uniform float uPhase;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // tail wobble: sprites face right, so the tail is at uv.x = 0
  float tail = 1.0 - uv.x;
  p.y += sin(uTime * uWobble + uPhase + uv.x * 5.0) * 0.022 * tail * tail * step(0.01, uWobble);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const frag = /* glsl */ `
uniform sampler2D map;
uniform float uFlash;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uOpacity;
uniform float uGhost;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  if (uGhost > 0.5) {
    // dotted outline of a missing partner: edge pixels only, every other screen pixel
    float a = c.a;
    vec2 t2 = uTexel * 2.5;
    float n = texture2D(map, vUv + vec2(t2.x, 0.0)).a + texture2D(map, vUv - vec2(t2.x, 0.0)).a
            + texture2D(map, vUv + vec2(0.0, t2.y)).a + texture2D(map, vUv - vec2(0.0, t2.y)).a;
    if (a < 0.5) discard;
    bool edge = n < 3.5;
    float dots = mod(floor(gl_FragCoord.x / 2.0) + floor(gl_FragCoord.y / 2.0), 2.0);
    // faint silhouette + dotted white rim
    float alpha = edge ? (dots > 0.5 ? uOpacity : 0.0) : uOpacity * 0.22;
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    return;
  }
  if (c.a < 0.5) discard;
  vec3 col = mix(c.rgb, c.rgb * uTint, uTintAmt);
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}`;

export interface FishUniforms {
  [k: string]: THREE.IUniform;
  map: THREE.IUniform<THREE.Texture>;
  uTime: THREE.IUniform<number>;
  uWobble: THREE.IUniform<number>;
  uPhase: THREE.IUniform<number>;
  uFlash: THREE.IUniform<number>;
  uTint: THREE.IUniform<THREE.Color>;
  uTintAmt: THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
  uGhost: THREE.IUniform<number>;
  uTexel: THREE.IUniform<THREE.Vector2>;
}

/** Fish sprite material: tail-wobble vertex shader, white level-up flash, depth tint, ghost outline. */
export function fishMaterial(map: THREE.Texture, phase: number, ghost = false): THREE.ShaderMaterial & { uniforms: FishUniforms } {
  const uniforms: FishUniforms = {
    map: { value: map },
    uTime: { value: 0 },
    uWobble: { value: 4 },
    uPhase: { value: phase },
    uFlash: { value: 0 },
    uTint: { value: new THREE.Color('#8fb7d6') },
    uTintAmt: { value: 0 },
    uOpacity: { value: ghost ? 0.7 : 1 },
    uGhost: { value: ghost ? 1 : 0 },
    uTexel: { value: new THREE.Vector2(1 / 64, 1 / 64) },
  };
  const m = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: !ghost });
  return m as THREE.ShaderMaterial & { uniforms: FishUniforms };
}

/** Shiny fallback when no `_shiny` art exists: hue-rotated, saturated copy of the sprite. */
export function shinyTint(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.filter = 'hue-rotate(150deg) saturate(1.5) brightness(1.08)';
  ctx.drawImage(img, 0, 0);
  return c;
}
