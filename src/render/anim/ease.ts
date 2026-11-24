/** Easing + motion-profile helpers (all procedural motion lives under src/render/anim). */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential approach factor. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/**
 * Leg profile with smooth acceleration/deceleration ramps (ramp = fraction of the leg).
 * Velocity: smoothstep up, cruise, smoothstep down. Returns normalised position and
 * velocity (both in leg-lengths per leg-duration).
 */
export function legProfile(u: number, ramp = 0.25): { pos: number; vel: number } {
  const t = clamp01(u);
  const vmax = 1 / (1 - ramp);
  const F = (s: number) => s * s * s - (s * s * s * s) / 2; // ∫ smoothstep
  if (t < ramp) return { pos: vmax * ramp * F(t / ramp), vel: vmax * smoothstep(t / ramp) };
  if (t > 1 - ramp) {
    const s = (1 - t) / ramp;
    return { pos: 1 - vmax * ramp * F(s), vel: vmax * smoothstep(s) };
  }
  return { pos: vmax * (ramp * 0.5 + (t - ramp)), vel: vmax };
}
