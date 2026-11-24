/**
 * Tank water layers: backdrop (+ blurred coast drifting behind the back glass, god rays),
 * sand floor with caustics, and the front overlay (wobbling surface line + air gap, glass
 * sheen, and the carriage wall/brass frame painted in the car's paint colour).
 */
import * as THREE from 'three';
import { TANK } from './layout';

const quadVert = /* glsl */ `
varying vec2 vUv;
varying vec2 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xy;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const backFrag = /* glsl */ `
uniform sampler2D uBack;
uniform sampler2D uCoast;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uScroll;
uniform float uTime;
uniform vec3 uDeep;
varying vec2 vUv;
void main() {
  vec3 col = texture2D(uBack, vUv).rgb;
  col = mix(col, col * uTint * 1.15, uTintAmt);
  // coast seen through the back glass: 9-tap blur, scrolled by train motion
  vec2 cuv = vec2(vUv.x * 0.6 + uScroll, (vUv.y - 0.5) * 1.6);
  vec3 coast = vec3(0.0);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
    coast += texture2D(uCoast, cuv + vec2(float(i) * 0.012, float(j) * 0.03)).rgb;
  coast /= 9.0;
  float cm = smoothstep(0.5, 0.85, vUv.y) * 0.22;
  col = mix(col, mix(coast, uDeep, 0.25), cm);
  // god rays
  float rays = sin(vUv.x * 9.0 + vUv.y * 3.0 + uTime * 0.3) * 0.5 + 0.5;
  col += pow(rays, 6.0) * 0.07 * vUv.y;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const sandFrag = /* glsl */ `
uniform vec3 uSand;
uniform float uTime;
varying vec2 vUv;
varying vec2 vWorld;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float top = 0.86 + sin(vWorld.x * 0.9) * 0.06 + sin(vWorld.x * 2.3) * 0.03;
  if (vUv.y > top) discard;
  vec2 px = floor(vWorld * 16.0);
  float n = h(px);
  vec3 col = uSand * (0.82 + vUv.y * 0.25) * (0.94 + n * 0.1);
  float cau = pow(abs(sin(vWorld.x * 3.0 + sin(vWorld.y * 5.0 + uTime * 1.3) + uTime)), 10.0);
  col += cau * 0.14;
  col *= 1.0 - step(top - 0.06, vUv.y) * 0.1;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const frontFrag = /* glsl */ `
uniform float uTime;
uniform float uTilt;
uniform vec3 uPaint;
uniform vec2 uTank;
uniform float uSurface;
varying vec2 vWorld;
void main() {
  vec2 w = vWorld;
  float frame = 0.16;
  bool inside = w.x > 0.0 && w.x < uTank.x && w.y > 0.0 && w.y < uTank.y;
  if (inside) {
    vec2 uv = w / uTank;
    float level = uSurface + uTilt * (uv.x - 0.5) * 0.45 + sin(uv.x * 18.0 + uTime * 2.2) * 0.006 + sin(uv.x * 7.0 - uTime * 1.3) * 0.004;
    vec4 o = vec4(0.0);
    if (uv.y > level) o = vec4(0.86, 0.95, 0.96, 0.82);
    else if (uv.y > level - 0.012) o = vec4(0.95, 1.0, 1.0, 0.85);
    else if (uv.y > level - 0.05) o = vec4(1.0, 1.0, 1.0, 0.12 * (1.0 - (level - uv.y) / 0.05));
    float sheen = smoothstep(0.03, 0.0, abs(fract(uv.x * 1.1 - uv.y * 0.55 + 0.15) - 0.5) - 0.07);
    o.rgb = mix(o.rgb, vec3(1.0), sheen * 0.4);
    o.a = max(o.a, sheen * 0.07);
    float edge = min(min(uv.x, 1.0 - uv.x) * uTank.x, min(uv.y, 1.0 - uv.y) * uTank.y);
    o = mix(vec4(0.1, 0.2, 0.3, 0.28), o, smoothstep(0.0, 0.5, edge));
    gl_FragColor = o;
  } else {
    // carriage wall in paint colour, brass frame + rivets
    float dx = max(max(-w.x, w.x - uTank.x), 0.0);
    float dy = max(max(-w.y, w.y - uTank.y), 0.0);
    float d = max(dx, dy);
    vec3 col = uPaint * (0.9 + 0.1 * sin(w.y * 3.0));
    if (d < frame) {
      col = vec3(0.79, 0.64, 0.29) * (0.8 + 0.4 * (1.0 - d / frame));
      vec2 rp = fract(w * 2.0) - 0.5;
      if (d > frame * 0.35 && d < frame * 0.75 && length(rp) < 0.12) col = vec3(0.96, 0.86, 0.55);
    }
    gl_FragColor = vec4(col, 1.0);
  }
  #include <colorspace_fragment>
}`;

export interface WaterLayers {
  group: THREE.Group;
  setBackdrop(tex: THREE.Texture, tint: string, tintAmt: number): void;
  setCoast(tex: THREE.Texture): void;
  setSand(hex: string): void;
  setPaint(hex: string): void;
  update(time: number, tilt: number, scroll: number): void;
}

export function createWater(): WaterLayers {
  const group = new THREE.Group();
  const backU = {
    uBack: { value: new THREE.Texture() as THREE.Texture },
    uCoast: { value: new THREE.Texture() as THREE.Texture },
    uTint: { value: new THREE.Color('#ffffff') },
    uTintAmt: { value: 0 },
    uScroll: { value: 0 },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#2a8fb4') },
  };
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(TANK.w, TANK.h),
    new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: backFrag, uniforms: backU, depthTest: false, depthWrite: false }),
  );
  back.position.set(TANK.w / 2, TANK.h / 2, -10);
  back.renderOrder = -100;

  const sandU = { uSand: { value: new THREE.Color('#f2e2bd') }, uTime: { value: 0 } };
  const sandH = TANK.floor + 0.25;
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(TANK.w, sandH),
    new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: sandFrag, uniforms: sandU, depthTest: false, depthWrite: false }),
  );
  sand.position.set(TANK.w / 2, sandH / 2, -9);
  sand.renderOrder = -90;

  const frontU = {
    uTime: { value: 0 },
    uTilt: { value: 0 },
    uPaint: { value: new THREE.Color('#8fd1b8') },
    uTank: { value: new THREE.Vector2(TANK.w, TANK.h) },
    uSurface: { value: TANK.surface / TANK.h },
  };
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(TANK.w * 6, TANK.h * 6),
    new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: frontFrag, uniforms: frontU, transparent: true, depthTest: false, depthWrite: false }),
  );
  front.position.set(TANK.w / 2, TANK.h / 2, 8);
  front.renderOrder = 100;
  group.add(back, sand, front);

  return {
    group,
    setBackdrop(tex, tint, amt) {
      backU.uBack.value = tex;
      backU.uTint.value.set(tint);
      backU.uTintAmt.value = amt;
    },
    setCoast(tex) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      backU.uCoast.value = tex;
    },
    setSand: (hex) => void sandU.uSand.value.set(hex),
    setPaint: (hex) => void frontU.uPaint.value.set(hex),
    update(time, tilt, scroll) {
      backU.uTime.value = time;
      backU.uScroll.value = scroll;
      sandU.uTime.value = time;
      frontU.uTime.value = time;
      frontU.uTilt.value = tilt;
    },
  };
}
