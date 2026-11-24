// Bot-owned seeded RNG (separate stream from the sim's, so bots never perturb it).
import { rngNext, seedToState } from '../sim/rng';

export interface BotRng {
  next(): number;
  int(n: number): number;
  pick<T>(arr: readonly T[]): T | undefined;
  chance(p: number): boolean;
}

export function botRng(seed: number): BotRng {
  let st = seedToState(seed ^ 0x5bd1e995);
  const next = (): number => {
    const [v, s] = rngNext(st);
    st = s;
    return v;
  };
  const int = (n: number): number => Math.min(n - 1, Math.floor(next() * n));
  return {
    next,
    int,
    pick: (arr) => (arr.length ? arr[int(arr.length)] : undefined),
    chance: (p) => next() < p,
  };
}
