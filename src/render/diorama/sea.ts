import * as THREE from 'three';
import { SUNNY } from '../paint/palette';

const vert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform float uTime;
uniform vec3 uNear;
uniform vec3 uMid;
uniform vec3 uFar;
uniform vec3 uFoam;
uniform vec3 uHaze;
uniform vec3 uCam;
uniform float uSunX;
varying vec3 vWorld;
void main() {
  float d = clamp((uCam.z - vWorld.z) / 420.0, 0.0, 1.0);
  vec3 col = mix(uNear, uMid, smoothstep(0.0, 0.12, d));
  col = mix(col, uFar, smoothstep(0.08, 0.6, d));
  // stylised wave crest lines, denser and finer with distance
  float zf = vWorld.z;
  float scale = mix(1.0, 0.25, d);
  float w1 = sin(vWorld.x * 0.55 * scale + uTime * 0.9 + sin(zf * 0.35 + uTime * 0.4) * 1.6 + zf * 0.15);
  float w2 = sin(zf * 1.7 + sin(vWorld.x * 0.21) * 2.0 - uTime * 0.6);
  float crest = smoothstep(0.78, 0.95, w1 * 0.5 + w2 * 0.5 + 0.15);
  col = mix(col, uFoam, crest * mix(0.55, 0.15, d));
  // sun glitter path
  float glit = exp(-pow((vWorld.x - uSunX) / mix(10.0, 90.0, d), 2.0)) * smoothstep(0.05, 0.6, d);
  float spark = step(0.93, fract(sin(dot(floor(vWorld.xz * vec2(0.8, 2.0)), vec2(12.9898, 78.233)) + floor(uTime * 3.0)) * 43758.5453));
  col += glit * (0.12 + spark * 0.45) * vec3(1.0, 0.97, 0.85);
  // near-shore darkening + far haze
  col = mix(col, uHaze, smoothstep(0.35, 1.0, d) * 0.65);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createSea(seaY: number): { mesh: THREE.Mesh; update: (t: number, cam: THREE.Vector3) => void } {
  const geo = new THREE.PlaneGeometry(1400, 440);
  geo.rotateX(-Math.PI / 2);
  const c = (h: string) => new THREE.Color(h);
  const uniforms = {
    uTime: { value: 0 },
    uNear: { value: c(SUNNY.seaNear) },
    uMid: { value: c(SUNNY.seaMid) },
    uFar: { value: c(SUNNY.seaFar) },
    uFoam: { value: c(SUNNY.foam) },
    uHaze: { value: c('#cfe9e4') },
    uCam: { value: new THREE.Vector3() },
    uSunX: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, seaY, -220);
  mesh.frustumCulled = false;
  return {
    mesh,
    update: (t, cam) => {
      uniforms.uTime.value = t;
      uniforms.uCam.value.copy(cam);
      uniforms.uSunX.value = cam.x - 70;
      mesh.position.x = cam.x;
    },
  };
}
