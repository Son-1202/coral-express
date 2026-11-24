/**
 * Motion profiles (SPEC C) — reusable by any view. `createMover(profile, seed, bounds)` returns a
 * Mover; call `step(dt, env)` every frame and draw `mover.pose`. Swarm movers also expose
 * per-agent arrays (`xs`, `ys`, `vxs`, `vys`, `phases`) for an instanced mesh.
 */
import { Darter, Glider, Hoverer } from './swimmers';
import { Crawler, Hopper, Pulser, Sessile } from './bottom';
import { Swarm } from './swarm';
import type { MotionBounds, MotionProfile, Mover, MoverOpts } from './types';

export * from './types';
export { Darter, Glider, Hoverer, Crawler, Hopper, Pulser, Sessile, Swarm };
export { SWARM_MIN, SWARM_MAX } from './swarm';
export { makeRng } from './rng';

export const ALL_PROFILES: readonly MotionProfile[] = [
  'darter', 'hoverer', 'glider', 'sinuous', 'crawler', 'hopper', 'pulser', 'swarm', 'sessile',
];

export function createMover(profile: MotionProfile, seed: number, bounds: MotionBounds, opts: MoverOpts & { count?: number } = {}): Mover {
  switch (profile) {
    case 'darter': return new Darter(seed, bounds, opts);
    case 'hoverer': return new Hoverer(seed, bounds, opts);
    case 'glider': return new Glider(seed, bounds, opts);
    case 'sinuous': return new Glider(seed, bounds, opts, true);
    case 'crawler': return new Crawler(seed, bounds, opts);
    case 'hopper': return new Hopper(seed, bounds, opts);
    case 'pulser': return new Pulser(seed, bounds, opts);
    case 'swarm': return new Swarm(seed, bounds, opts);
    case 'sessile': return new Sessile(seed, bounds, opts);
  }
}

export function isSwarm(m: Mover): m is Swarm {
  return m instanceof Swarm;
}
