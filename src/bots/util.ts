// Small helpers shared by the bots.
import type { Action, DecorPlacement, Sim, SimState } from '../sim';

/** Legal and affordable right now (Tickets for upgrades are checked by price() itself). */
export function canDo(sim: Sim, a: Action): boolean {
  const p = sim.price(a);
  return p !== null && p <= sim.state.shells;
}

/** Decor ids owned but not placed in any carriage. */
export function trayDecor(s: SimState): string[] {
  const placed: Record<string, number> = {};
  for (const c of s.carriages) for (const d of c.decor) placed[d.id] = (placed[d.id] ?? 0) + 1;
  return Object.keys(s.decorOwned).filter((id) => (s.decorOwned[id] ?? 0) > (placed[id] ?? 0));
}

/** A tidy floor placement; `r` in [0,1) spreads items across the tank. */
export function decorPlacement(r: number): DecorPlacement {
  return { x: 0.1 + 0.8 * r, y: 0, layer: 'back', scale: 1, flip: false };
}
