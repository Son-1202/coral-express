// Train shuttle, arrivals, fares, station visits, terminals (SPEC B4.2, B4.16).
import type { Ctx } from './ctx';
import { fareBaseMult, stationMult } from './income';
import { stationId } from './lookup';
import { legSeconds } from './upgrades';

/** Product of active timed fare modifiers (optionally incl. next-arrival ones). */
export function fareModifierMult(ctx: Ctx, includeNextArrival: boolean): number {
  let m = 1;
  for (const mod of ctx.state.modifiers) {
    if (mod.kind === 'fareMult' || (includeNextArrival && mod.kind === 'nextArrivalFareMult')) m *= mod.value;
  }
  return m;
}

/** Fare that an arrival at `station` would pay right now (without modifiers). */
export function fareAt(ctx: Ctx, station: number): number {
  return ctx.model().totalAppeal * fareBaseMult(ctx.idx, ctx.state, ctx.fx()) * stationMult(ctx.idx, station);
}

export function addStamp(ctx: Ctx, kind: 'station' | 'species' | 'shiny', ref: string): void {
  const id = `${kind}:${ref}`;
  if (ctx.state.permanent.stamps.includes(id)) return;
  ctx.state.permanent.stamps.push(id);
  ctx.emit({ type: 'stamp', stampId: id, kind, ref });
}

/** Market bookkeeping, first-visit stamp and postcard for a station. */
export function visitStation(ctx: Ctx, station: number): void {
  const s = ctx.state;
  s.marketStation = station;
  if (!s.visitedThisRun.includes(station)) s.visitedThisRun.push(station);
  const sid = stationId(s.currentLine, station);
  addStamp(ctx, 'station', sid);
  if (!s.permanent.postcards.includes(sid)) {
    s.permanent.postcards.push(sid);
    const finalTerminal = s.currentLine === ctx.idx.maxLine && station === ctx.idx.data.config.stationsPerLine;
    ctx.emit({ type: 'postcard', stationId: sid, suppressToast: finalTerminal });
  }
}

function arrive(ctx: Ctx, station: number): void {
  const s = ctx.state;
  const line = s.currentLine;
  ctx.emit({ type: 'arrive', station, stationId: stationId(line, station), line });
  const amount = fareAt(ctx, station) * fareModifierMult(ctx, true);
  // "Until next arrival" modifiers are consumed by this arrival.
  s.modifiers = s.modifiers.filter((m) => m.until !== null && m.kind !== 'nextArrivalFareMult');
  if (amount > 0) {
    s.shells += amount;
    s.runShells += amount;
    s.lifetime.shellsEarned += amount;
    s.lifetime.fareShells += amount;
  }
  s.lifetime.arrivals++;
  ctx.emit({ type: 'fare', amount, station });
  visitStation(ctx, station);
  if (station === ctx.idx.data.config.stationsPerLine) reachTerminal(ctx);
}

function reachTerminal(ctx: Ctx): void {
  const s = ctx.state;
  const p = s.permanent;
  const line = s.currentLine;
  if (s.terminalReachedThisRun) return;
  s.terminalReachedThisRun = true;
  const firstTime = !p.reachedTerminals.includes(line);
  ctx.emit({ type: 'terminalReached', line, firstTime });
  if (!firstTime) return;
  p.reachedTerminals.push(line);
  for (const l of ctx.idx.data.lines) {
    if (l.opensAfter === line && !p.openedLines.includes(l.id)) {
      p.openedLines.push(l.id);
      ctx.emit({ type: 'lineOpened', line: l.id });
    }
  }
  if (line === ctx.idx.maxLine && !p.endless) {
    p.endless = true;
    ctx.invalidate();
    ctx.emit({ type: 'ending', line });
  }
}

/** Advance the train by dt seconds (dt ≤ one tick; handles phase changes inside it). */
export function tickTrain(ctx: Ctx, dt: number): void {
  const cfg = ctx.idx.data.config;
  const leg = legSeconds(ctx.idx, ctx.fx());
  let rem = dt;
  // Bounded loop: each iteration completes one phase (phases are ≥ 1 tick long in data).
  for (let guard = 0; guard < 16 && rem > 0; guard++) {
    const tr = ctx.state.train;
    const dur = tr.phase === 'moving' ? leg : cfg.stopSeconds;
    const need = dur - tr.t;
    if (rem < need - 1e-9) { tr.t += rem; return; }
    rem -= Math.max(0, need);
    tr.t = 0;
    if (tr.phase === 'moving') {
      tr.phase = 'stopped';
      tr.fromStation = tr.toStation;
      arrive(ctx, tr.fromStation);
    } else {
      const from = tr.fromStation;
      if (tr.dir === 1 && from >= ctx.state.builtTo) tr.dir = -1;
      else if (tr.dir === -1 && from <= 1) tr.dir = 1;
      tr.toStation = Math.min(Math.max(from + tr.dir, 1), ctx.state.builtTo);
      tr.phase = 'moving';
      ctx.emit({ type: 'depart', from, to: tr.toStation });
    }
  }
}
