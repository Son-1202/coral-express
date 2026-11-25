// Depot Reset (SPEC B4.9, B4.14) and Depot Upgrades (B5.4).
import { fail, findFish, okCheck, type Check } from './actionCheck';
import { spawnFish } from './actionsFish';
import type { Ctx } from './ctx';
import { lineDef } from './lookup';
import { endSight } from './sights';
import { startRun, startSlots } from './state';
import type { Action, DepotPreview } from './types';
import { ticketMult } from './upgrades';

type A<T extends Action['type']> = Extract<Action, { type: T }>;

/** Ticket divisor of the current Line (T-20: per-Line, fallback config divisor). */
function ticketDivisor(ctx: Ctx): number {
  return lineDef(ctx.idx, ctx.state.currentLine).ticketDivisor ?? ctx.idx.data.config.depotReset.divisor;
}

/**
 * Tickets a reset grants for `runShells` (T-33): floor(sqrt(runShells / divisor)), but at least 1
 * once the run meets `minRunShells` — an eligible reset is never worth 0 Tickets.
 */
function ticketsFor(ctx: Ctx, runShells: number): number {
  const raw = Math.floor(Math.sqrt(Math.max(0, runShells) / ticketDivisor(ctx)));
  return runShells >= ctx.idx.data.config.depotReset.minRunShells ? Math.max(1, raw) : raw;
}

/** Tickets a Depot Reset would grant now (the exact grant once `canDepotReset`). */
export function projectedTickets(ctx: Ctx): number {
  return ticketsFor(ctx, ctx.state.runShells);
}

export function canDepotReset(ctx: Ctx): boolean {
  const s = ctx.state;
  return s.runShells >= ctx.idx.data.config.depotReset.minRunShells && s.terminalReachedThisRun;
}

/** Everything the Depot panel shows about a reset, from the sim (T-33). */
export function depotPreview(ctx: Ctx): DepotPreview {
  const s = ctx.state;
  const cfg = ctx.idx.data.config;
  // The grant once the reset is allowed: the real grant when eligible, else what the run's Shells
  // would give at the gate (at least 1 — the panel never promises a 0-Ticket reset).
  const tickets = ticketsFor(ctx, Math.max(s.runShells, cfg.depotReset.minRunShells));
  // Run Shells at which the grant becomes tickets + 1: (n+1)² × divisor.
  const nextTicketAt = (tickets + 1) ** 2 * ticketDivisor(ctx);
  const now = ticketMult(ctx.idx, s);
  return {
    eligible: canDepotReset(ctx),
    terminalReached: s.terminalReachedThisRun,
    furthestStation: Math.max(1, ...s.visitedThisRun),
    terminalStation: cfg.stationsPerLine,
    runShells: s.runShells,
    minRunShells: cfg.depotReset.minRunShells,
    tickets,
    nextTicketAt,
    incomeMult: now,
    incomeMultAfter: now + cfg.ticketIncomePerTicket * tickets,
  };
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
