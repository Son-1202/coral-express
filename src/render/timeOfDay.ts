/** Time of day drifts morning → afternoon → dusk → night on a 6-minute cycle (SPEC B9). */
export const DAY_CYCLE_SECONDS = 360;

export const TIME_NAMES = { morning: 0, afternoon: 0.25, dusk: 0.5, night: 0.75 } as const;
export type TimeName = keyof typeof TIME_NAMES;

/** t ∈ [0,1) from seconds (+ an optional pinned offset). */
export function dayPhase(seconds: number): number {
  return (((seconds / DAY_CYCLE_SECONDS) % 1) + 1) % 1;
}

/** 0 by day → 1 at night; lamps start glowing during dusk. */
export function nightAmount(t: number): number {
  const p = ((t % 1) + 1) % 1;
  // dusk ramps 0.4 → 0.6, full night 0.6 → 0.92, dawn 0.92 → 1.0
  if (p < 0.4) return 0;
  if (p < 0.6) return (p - 0.4) / 0.2;
  if (p < 0.92) return 1;
  return 1 - (p - 0.92) / 0.08;
}
