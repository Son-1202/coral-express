// Shared action plumbing: every action is validated by a `check` that returns its cost
// and a deferred `apply`. `price()` and `act()` both go through the same check, so
// the UI price and the real purchase can never disagree.
import type { Ctx } from './ctx';
import type { Carriage, FailReason, Fish } from './types';

export type Check =
  | { ok: true; cost: number; apply: () => void }
  | { ok: false; reason: FailReason };

export const fail = (reason: FailReason): Check => ({ ok: false, reason });
export const okCheck = (cost: number, apply: () => void): Check => ({ ok: true, cost, apply });

export function findCar(ctx: Ctx, carId: string): Carriage | undefined {
  return ctx.state.carriages.find((c) => c.id === carId);
}

export function carIndex(ctx: Ctx, carId: string): number {
  return ctx.state.carriages.findIndex((c) => c.id === carId);
}

export function findFish(ctx: Ctx, fishId: string): Fish | undefined {
  return ctx.state.fish[fishId];
}

/** Credit Shells earned this run (income, fares, rewards). */
export function earn(ctx: Ctx, amount: number): void {
  const s = ctx.state;
  s.shells += amount;
  s.runShells += amount;
  s.lifetime.shellsEarned += amount;
}
