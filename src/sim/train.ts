// Train shuttle, arrivals, fares, station visits, terminals (SPEC B4.2, B4.16).
import type { Ctx } from './ctx';
import { stationId } from './lookup';
import { openMarket } from './market';
import { fareAt, fareModifierMult } from './rates';
import { updateRequests } from './requests';
import { legSeconds } from './upgrades';

export { fareAt, fareModifierMult } from './rates';

export function addStamp(ctx: Ctx, kind: 'station' | 'species' | 'shiny', ref: string): void {
  const id = `${kind}:${ref}`;
  if (ctx.state.permanent.stamps.includes(id)) return;
  ctx.state.permanent.stamps.push(id);
  ctx.emit({ type: 'stamp', stampId: id, kind, ref });
}

/**
 * Station visit: first-visit stamp + postcard, request board (completions only on a
 * real arrival) and that station's market (open until the next arrival).
 */
export function visitStation(ctx: Ctx, station: number, arrived = false): void {
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
  updateRequests(ctx, sid, arrived);
  openMarket(ctx, station);
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
  visitStation(ctx, station, true);
  if (station === ctx.idx.data.config.stationsPerLine) reachTerminal(ctx);
}

function reachTerminal(ctx: Ctx): void {
  const s = ctx.state;
  const p = s.permanent;
  const line = s.currentLine;
  if (s.terminalReachedThisRun) return;
  s.terminalReachedThisRun = true;
  const firstTime = !p.reachedTerminals.includes(line);
  // T-20: count runs that reached this terminal; a Line opens after `opensAfterRuns` of them.
  const runs = (p.terminalRuns[String(line)] ?? 0) + 1;
  p.terminalRuns[String(line)] = runs;
  ctx.emit({ type: 'terminalReached', line, firstTime });
  if (firstTime) p.reachedTerminals.push(line);
  for (const l of ctx.idx.data.lines) {
    if (l.opensAfter === line && runs >= (l.opensAfterRuns ?? 1) && !p.openedLines.includes(l.id)) {
      p.openedLines.push(l.id);
      ctx.emit({ type: 'lineOpened', line: l.id });
    }
  }
  if (firstTime && line === ctx.idx.maxLine && !p.endless) {
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
