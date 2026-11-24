import * as THREE from 'three';

const frag = /* glsl */ `
uniform float uFrac;
uniform float uReady;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0 || r < 0.55) discard;
  float a = atan(p.x, p.y) / 6.2831853 + 0.5; // 0 at top, clockwise
  vec3 track = vec3(0.13, 0.2, 0.22);
  vec3 fill = mix(vec3(0.95, 0.75, 0.3), vec3(0.55, 0.95, 0.75), uReady);
  vec3 col = a <= uFrac ? fill : track;
  float edge = smoothstep(1.0, 0.92, r) * smoothstep(0.55, 0.62, r);
  gl_FragColor = vec4(col, 0.9 * edge);
}`;
const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

/** Cooldown ring on a carriage door (fills as the Feeding Frenzy recharges). */
export class FrenzyRing {
  readonly mesh: THREE.Mesh;
  private readonly u = { uFrac: { value: 0 }, uReady: { value: 0 } };
  private readyFlash = 0;
  private cooling = false;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.26),
      new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: this.u, transparent: true, depthWrite: false }),
    );
    this.mesh.renderOrder = 8;
    this.mesh.visible = false;
  }

  /** frac 0..1 of the cooldown elapsed; null = ready/idle (hidden). */
  set(frac: number | null, dt: number): void {
    if (frac === null) {
      if (this.cooling) this.readyFlash = 0.6;
      this.cooling = false;
      this.readyFlash = Math.max(0, this.readyFlash - dt);
      this.u.uFrac.value = 1;
      this.u.uReady.value = 1;
      this.mesh.visible = this.readyFlash > 0;
      const s = 1 + this.readyFlash * 0.6;
      this.mesh.scale.set(s, s, 1);
      return;
    }
    this.cooling = true;
    this.mesh.visible = true;
    this.mesh.scale.set(1, 1, 1);
    this.u.uFrac.value = frac;
    this.u.uReady.value = 0;
  }
}
