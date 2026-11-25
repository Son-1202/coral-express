// Depot Reset (SPEC B4.9, B4.14) and Depot Upgrades (B5.4).
import { fail, findFish, okCheck, type Check } from './actionCheck';
import { spawnFish } from './actionsFish';
import type { Ctx } from './ctx';
import { lineDef } from './lookup';
import { endSight } from './sights';
import { startRun, startSlots } from './state';
import type { Action } from './types';

type A<T extends Action['type']> = Extract<Action, { type: T }>;

export function projectedTickets(ctx: Ctx): number {
  const d = ctx.idx.data.config.depotReset;
  // T-20: per-Line divisor so each Line's bigger economy doesn't explode Tickets.
  const div = lineDef(ctx.idx, ctx.state.currentLine).ticketDivisor ?? d.divisor;
  return Math.floor(Math.sqrt(Math.max(0, ctx.state.runShells) / div));
}

export function canDepotReset(ctx: Ctx): boolean {
  const s = ctx.state;
  return s.runShells >= ctx.idx.data.config.depotReset.minRunShells && s.terminalReachedThisRun;
}

export function checkDepotReset(ctx: Ctx, a: A<'depotReset'>): Check {
  const s = ctx.state;
  if (!canDepotReset(ctx)) return fail('notReady');
  const f = findFish(ctx, a.mascotFishId);
  if (!f) return fail('unknownFish');
  if (!s.permanent.openedLines.includes(a.nextLine)) return fail('locked');
  return okCheck(0, () => {
    const cfg = ctx.idx.data.config;
    const p = s.permanent;
    const tickets = projectedTickets(ctx);
    p.tickets += tickets;
    p.totalTicketsEarned += tickets;
    p.resets++;
    p.oldFriendStreak = p.mascot?.species === f.species ? p.oldFriendStreak + 1 : 1;
    if (p.oldFriendStreak >= cfg.mascot.oldFriendStreak) p.oldFriend = true;
    const name = a.mascotName ?? f.nickname ?? ctx.idx.species.get(f.species)?.name ?? f.species;
    p.mascot = { species: f.species, shiny: f.shiny, nickname: name };
    endSight(ctx, false, true);
    ctx.emit({ type: 'depotReset', tickets, totalTicketsEarned: p.totalTicketsEarned, line: a.nextLine, mascotSpecies: f.species, oldFriend: p.oldFriend });
    startRun(ctx, a.nextLine);
    placeMascot(ctx);
  });
}

/** Put the permanent Mascot into the Heritage carriage (level mascot.startLevel). */
export function placeMascot(ctx: Ctx): void {
  const s = ctx.state;
  const m = s.permanent.mascot;
  const h = s.carriages.find((c) => c.heritage);
  if (!m || !h || !ctx.idx.species.has(m.species)) return;
  const f = spawnFish(ctx, m.species, h.id, { level: ctx.idx.data.config.mascot.startLevel, shiny: m.shiny });
  f.mascot = true;
  if (m.nickname) f.nickname = m.nickname;
  ctx.refreshBonds();
}

export function checkBuyUpgrade(ctx: Ctx, a: A<'buyUpgrade'>): Check {
  const s = ctx.state;
  const u = ctx.idx.upgrades.get(a.id);
  if (!u) return fail('invalid');
  if (s.permanent.upgrades.includes(u.id)) return fail('owned');
  if (s.permanent.tickets < u.cost) return fail('cantAfford');
  // Costs Tickets, not Shells: price() reports 0.
  return okCheck(0, () => {
    s.permanent.tickets -= u.cost;
    s.permanent.upgrades.push(u.id);
    ctx.invalidate();
    // Double Decker also lifts current carriages to the new start slots.
    const min = startSlots(ctx);
    for (const c of s.carriages) if (c.slots < min) c.slots = min;
    ctx.invalidate();
    ctx.emit({ type: 'upgradeBought', id: u.id, tickets: u.cost });
  });
}
