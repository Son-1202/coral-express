import * as THREE from 'three';
import { makeCanvas, rng, toTexture } from '../paint/canvas';
import { outline } from './paintTrain';

/** Reef-style tank decor (corals, anemone, rocks) painted on a transparent canvas. */
function paintDecor(seed: number): HTMLCanvasElement {
  const p = makeCanvas(74, 32);
  const { ctx, w, h } = p;
  const r = rng(seed);
  // rocks
  for (let i = 0; i < 3; i++) {
    const x = 6 + r() * (w - 12);
    ctx.fillStyle = '#8d7f8f';
    ctx.beginPath();
    ctx.ellipse(x, h - 2, 6 + r() * 6, 4 + r() * 3, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#a89aa8';
    ctx.fillRect(x - 3, h - 6, 4, 2);
  }
  // branching corals
  const corals = ['#ff8a9e', '#ffb36b', '#c08cf0', '#ff6f7d'];
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(5 + r() * (w - 10));
    const c = corals[i % corals.length] as string;
    ctx.fillStyle = c;
    const hgt = 8 + Math.floor(r() * 12);
    ctx.fillRect(x, h - hgt, 2, hgt);
    for (let b = 0; b < 3; b++) {
      const by = h - Math.floor(r() * hgt);
      const dir = r() < 0.5 ? -1 : 1;
      ctx.fillRect(x + dir * 2, by - 4, 2, 4);
      ctx.fillRect(Math.min(x, x + dir * 2), by, 3, 1);
    }
  }
  // anemone (pink tentacles)
  const ax = Math.floor(w * (0.3 + r() * 0.4));
  for (let t = -4; t <= 4; t++) {
    ctx.fillStyle = t % 2 ? '#ff9fc7' : '#ffd1e3';
    ctx.fillRect(ax + t, h - 6 - (4 - Math.abs(t)), 1, 6 + (4 - Math.abs(t)));
  }
  // kelp-ish strands
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(r() * w);
    ctx.fillStyle = '#4fae6a';
    for (let y = h; y > h - 14 - r() * 10; y -= 2) ctx.fillRect(x + (y % 4 === 0 ? 1 : 0), y - 2, 1, 2);
  }
  outline(p.canvas, 'rgba(30,40,60,0.6)');
  return p.canvas;
}

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const frag = /* glsl */ `
uniform float uTime;
uniform float uTilt;
uniform float uSeed;
uniform sampler2D uDecor;
uniform vec3 uWater;
uniform vec3 uDeep;
uniform vec3 uSand;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float level = 0.86 + uTilt * (uv.x - 0.5) + sin(uv.x * 18.0 + uTime * 2.2 + uSeed) * 0.008;
  // back wall: deep gradient with soft god-rays
  vec3 col = mix(uDeep, uWater, smoothstep(0.0, 0.9, uv.y));
  float rays = sin(uv.x * 9.0 + uv.y * 3.0 + uTime * 0.3 + uSeed) * 0.5 + 0.5;
  col += pow(rays, 6.0) * 0.08 * uv.y;
  // sand floor with caustics
  float sandH = 0.13 + sin(uv.x * 7.0 + uSeed) * 0.02;
  float cau = pow(abs(sin(uv.x * 40.0 + sin(uv.y * 30.0 + uTime * 1.3) + uTime)), 8.0);
  if (uv.y < sandH) col = uSand * (0.92 + uv.y * 0.6) + cau * 0.12;
  // decor with plant sway: offsetX = sin(t*freq + x*0.7) * amp * uv.y^2
  vec2 duv = vec2(uv.x, uv.y / 0.6);
  duv.x += sin(uTime * 1.6 + uv.x * 0.7 * 10.0) * 0.012 * duv.y * duv.y - uTilt * 0.05 * duv.y;
  if (duv.y <= 1.0) {
    vec4 d = texture2D(uDecor, duv);
    col = mix(col, d.rgb, d.a);
  }
  // air gap above the water line
  if (uv.y > level) {
    col = vec3(0.86, 0.95, 0.95);
  } else if (uv.y > level - 0.025) {
    col = mix(col, vec3(0.92, 1.0, 1.0), 0.7);
  }
  // glass sheen diagonals
  float sheen = smoothstep(0.02, 0.0, abs(fract(uv.x * 1.2 - uv.y * 0.55 + 0.15) - 0.5) - 0.08);
  col += sheen * 0.08;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface Tank {
  mesh: THREE.Mesh;
  setTilt(t: number): void;
  update(time: number): void;
}

export function createTank(seed: number, w: number, h: number): Tank {
  const decor = toTexture(paintDecor(seed), true);
  const uniforms = {
    uTime: { value: 0 },
    uTilt: { value: 0 },
    uSeed: { value: seed * 1.37 },
    uDecor: { value: decor },
    uWater: { value: new THREE.Color('#62d3dc') },
    uDeep: { value: new THREE.Color('#2a8fb4') },
    uSand: { value: new THREE.Color('#f1dfb4') },
  };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms }),
  );
  return {
    mesh,
    setTilt: (t) => (uniforms.uTilt.value = t),
    update: (time) => (uniforms.uTime.value = time),
  };
}

const FISH_KINDS = [
  { body: '#ff8a2a', stripe: '#ffffff', fin: '#e05a1a' }, // clownfish-ish
  { body: '#3d7ff0', stripe: '#16245a', fin: '#ffd23a' }, // blue tang-ish
  { body: '#ffd84a', stripe: '#ffd84a', fin: '#f0b020' }, // yellow tang-ish
  { body: '#ff7fb0', stripe: '#ffd1e3', fin: '#d8508a' },
] as const;

/** Tiny pixel fish placeholder facing right. */
export function paintFish(kind: number): HTMLCanvasElement {
  const k = FISH_KINDS[kind % FISH_KINDS.length] ?? FISH_KINDS[0];
  const p = makeCanvas(16, 11);
  const { ctx } = p;
  ctx.translate(1, 1);
  ctx.fillStyle = k.fin;
  ctx.fillRect(0, 2, 3, 5); // tail
  ctx.fillRect(5, 0, 4, 2); // dorsal
  ctx.fillStyle = k.body;
  ctx.fillRect(3, 2, 9, 5);
  ctx.fillRect(4, 1, 6, 7);
  ctx.fillStyle = k.stripe;
  ctx.fillRect(6, 1, 1, 7);
  ctx.fillRect(9, 2, 1, 5);
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(10, 3, 1, 1);
  outline(p.canvas, '#1e2c3a');
  return p.canvas;
}
