import { Effect } from 'postprocessing';
import * as THREE from 'three';

const frag = /* glsl */ `
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uSat;
uniform float uWarm;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  c = c * uGain + uLift * (1.0 - c);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);
  c += vec3(0.04, 0.01, -0.03) * uWarm;
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}`;

export interface Grade {
  lift: THREE.Color;
  gain: THREE.Color;
  sat: number;
  warm: number;
}

/** Simple colour-matrix grade (lift / gain / saturation / warmth) — per-region + time-of-day hook. */
export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', frag, {
      uniforms: new Map<string, THREE.Uniform>([
        ['uLift', new THREE.Uniform(new THREE.Color(0, 0, 0))],
        ['uGain', new THREE.Uniform(new THREE.Color(1, 1, 1))],
        ['uSat', new THREE.Uniform(1)],
        ['uWarm', new THREE.Uniform(0)],
      ]),
    });
  }

  set(g: Grade): void {
    (this.uniforms.get('uLift')?.value as THREE.Color).copy(g.lift);
    (this.uniforms.get('uGain')?.value as THREE.Color).copy(g.gain);
    const sat = this.uniforms.get('uSat');
    const warm = this.uniforms.get('uWarm');
    if (sat) sat.value = g.sat;
    if (warm) warm.value = g.warm;
  }
}

const c = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

/** Time-of-day keyframes (t in [0,1): morning → afternoon → dusk → night). */
const KEYS: Grade[] = [
  { lift: c(0.02, 0.02, 0.04), gain: c(1.0, 0.99, 0.97), sat: 1.06, warm: 0.2 }, // morning
  { lift: c(0.0, 0.0, 0.01), gain: c(1.02, 1.0, 0.96), sat: 1.1, warm: 0.45 }, // afternoon
  { lift: c(0.05, 0.0, 0.05), gain: c(1.05, 0.82, 0.72), sat: 1.05, warm: 0.9 }, // dusk
  { lift: c(0.0, 0.02, 0.07), gain: c(0.45, 0.55, 0.8), sat: 0.75, warm: -0.6 }, // night
];

export function gradeAt(t: number): Grade {
  const n = KEYS.length;
  const f = (((t % 1) + 1) % 1) * n;
  const i = Math.floor(f);
  const k = f - i;
  const a = KEYS[i % n] as Grade;
  const b = KEYS[(i + 1) % n] as Grade;
  return {
    lift: a.lift.clone().lerp(b.lift, k),
    gain: a.gain.clone().lerp(b.gain, k),
    sat: a.sat + (b.sat - a.sat) * k,
    warm: a.warm + (b.warm - a.warm) * k,
  };
}
