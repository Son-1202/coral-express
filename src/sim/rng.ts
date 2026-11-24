// Seeded RNG (mulberry32). The full RNG state is a single uint32 kept in SimState,
// so save/load reproduces the exact same random sequence.

/** Advance the RNG state; returns [value in [0,1), newState]. */
export function rngNext(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const v = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [v, s];
}

/** Turn any number seed into a valid uint32 RNG state. */
export function seedToState(seed: number): number {
  // Mix so that small consecutive seeds give unrelated streams.
  let h = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Mutable helper bound to an object holding `rngState`. */
export function rand(holder: { rngState: number }): number {
  const [v, s] = rngNext(holder.rngState);
  holder.rngState = s;
  return v;
}
