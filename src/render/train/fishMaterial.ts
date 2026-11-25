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
uniform float uLinePx;
varying vec2 vUv;
// alpha with everything outside the sprite quad treated as transparent (no clamp-to-edge gaps)
float ghostA(vec2 uv) {
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture2D(map, clamp(uv, 0.0, 1.0)).a * inb.x * inb.y;
}
void main() {
  vec4 c = texture2D(map, vUv);
  if (uGhost > 0.5) {
    // T-27: crisp dashed outline of the missing partner's real silhouette — inner edge of the
    // sprite alpha at native texel scale, but never thinner than uLinePx device pixels (k = texels
    // per line width when minified). No fill. Dashes run along the local edge direction and
    // are anchored to the sprite, so they don't crawl while the train moves.
    vec2 tex = 1.0 / uTexel;
    vec2 tc = vUv * tex;
    float k = max(1.0, max(fwidth(tc.x), fwidth(tc.y)) * uLinePx);
    vec2 cell = floor(tc / k);
    vec2 cuv = (cell + 0.5) * k * uTexel;
    vec2 o = uTexel * k;
    float a = ghostA(cuv);
    float r = ghostA(cuv + vec2(o.x, 0.0));
    float l = ghostA(cuv - vec2(o.x, 0.0));
    float u = ghostA(cuv + vec2(0.0, o.y));
    float d = ghostA(cuv - vec2(0.0, o.y));
    if (a < 0.5 || r + l + u + d > 3.5) discard;
    // tangent axis: a mostly-horizontal edge (alpha changes in y) dashes along x, else along y
    float along = abs(u - d) >= abs(r - l) ? cell.x : cell.y;
    float on = step(mod(along, 3.0), 1.5);
    // cream dash + faint teal gap so the line reads on bright water and on dark backdrops
    vec4 col = on > 0.5 ? vec4(1.0, 0.96, 0.84, uOpacity) : vec4(0.12, 0.3, 0.34, uOpacity * 0.5);
    gl_FragColor = col;
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
  /** Ghost outline width in device px (set to the renderer pixel ratio = 1 CSS px). */
  uLinePx: THREE.IUniform<number>;
}

/** Fish sprite material: tail-wobble vertex shader, white level-up flash, depth tint, dashed ghost outline. */
export function fishMaterial(map: THREE.Texture, phase: number, ghost = false): THREE.ShaderMaterial & { uniforms: FishUniforms } {
  const uniforms: FishUniforms = {
    map: { value: map },
    uTime: { value: 0 },
    uWobble: { value: ghost ? 0 : 4 },
    uPhase: { value: phase },
    uFlash: { value: 0 },
    uTint: { value: new THREE.Color('#8fb7d6') },
    uTintAmt: { value: 0 },
    uOpacity: { value: ghost ? 0.6 : 1 },
    uGhost: { value: ghost ? 1 : 0 },
    uTexel: { value: new THREE.Vector2(1 / 64, 1 / 64) },
    uLinePx: { value: 1 },
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
