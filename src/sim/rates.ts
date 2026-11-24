// Income-rate helpers shared by the tick, stats(), offline, sights, markets and requests.
import type { Ctx } from './ctx';
import { fareBaseMult, stationMult } from './income';
import type { SimState } from './types';
import { legSeconds } from './upgrades';

const EPS = 1e-9;

export function fishModifierMult(ctx: Ctx): number {
  let m = 1;
  for (const mod of ctx.state.modifiers) if (mod.kind === 'fishIncomeMult') m *= mod.value;
  return m;
}

/** Product of active timed fare modifiers (optionally incl. next-arrival ones). */
export function fareModifierMult(ctx: Ctx, includeNextArrival: boolean): number {
  let m = 1;
  for (const mod of ctx.state.modifiers) {
    if (mod.kind === 'fareMult' || (includeNextArrival && mod.kind === 'nextArrivalFareMult')) m *= mod.value;
  }
  return m;
}

/** Frenzy multiplier of one car right now. */
export function frenzyMult(ctx: Ctx, carId: string): number {
  const fr = ctx.state.frenzy[carId];
  return fr && ctx.state.time < fr.activeUntil - EPS ? ctx.idx.data.config.frenzy.mult : 1;
}

/** Current fish Shells/s (frenzy + timed modifiers applied). */
export function currentFishSps(ctx: Ctx): number {
  let sps = 0;
  for (const c of ctx.model().cars) sps += c.baseSps * frenzyMult(ctx, c.carId);
  return sps * fishModifierMult(ctx);
}

/** Fare that an arrival at `station` would pay right now (without modifiers). */
export function fareAt(ctx: Ctx, station: number): number {
  return ctx.model().totalAppeal * fareBaseMult(ctx.idx, ctx.state, ctx.fx()) * stationMult(ctx.idx, station);
}

/** Stations visited in one full shuttle cycle over track 1..n (n ≥ 2). */
export function cycleStations(n: number): number[] {
  const out: number[] = [];
  for (let k = 2; k <= n; k++) out.push(k);
  for (let k = n - 1; k >= 1; k--) out.push(k);
  return out;
}

export function nextStation(s: SimState): number {
  const tr = s.train;
  if (tr.phase === 'moving') return tr.toStation;
  let dir = tr.dir;
  if (dir === 1 && tr.fromStation >= s.builtTo) dir = -1;
  else if (dir === -1 && tr.fromStation <= 1) dir = 1;
  return Math.min(Math.max(tr.fromStation + dir, 1), s.builtTo);
}

/** Seconds per arrival (leg + stop). */
export function arrivalSeconds(ctx: Ctx): number {
  return legSeconds(ctx.idx, ctx.fx()) + ctx.idx.data.config.stopSeconds;
}

/** Average fare per arrival over one shuttle cycle, without timed modifiers. */
export function baseFarePerArrival(ctx: Ctx): number {
  const stations = cycleStations(ctx.state.builtTo);
  let sum = 0;
  for (const k of stations) sum += fareAt(ctx, k);
  return sum / stations.length;
}

/** Steady-state income without frenzy / Sights: fish + average fare rate. Used for
 *  "N seconds of income" rewards, Today's Special prices and offline earnings. */
export function baseIncome(ctx: Ctx): { fishSps: number; fareSps: number; totalSps: number } {
  const fishSps = ctx.model().baseFishSps;
  const fareSps = baseFarePerArrival(ctx) / arrivalSeconds(ctx);
  return { fishSps, fareSps, totalSps: fishSps + fareSps };
}

/** Credit one tick of fish income (per-species bookkeeping for the E1 dominance metric). */
export function creditFishIncome(ctx: Ctx, dt: number): number {
  const s = ctx.state;
  const mod = fishModifierMult(ctx) * dt;
  let total = 0;
  for (const c of ctx.model().cars) {
    if (c.baseSps <= 0) continue;
    const m = frenzyMult(ctx, c.carId) * mod;
    for (const f of c.fish) {
      const amt = f.sps * m;
      if (amt <= 0) continue;
      s.speciesShells[f.species] = (s.speciesShells[f.species] ?? 0) + amt;
      total += amt;
    }
  }
  if (total > 0) {
    s.shells += total;
    s.runShells += total;
    s.lifetime.shellsEarned += total;
    s.lifetime.fishShells += total;
  }
  return total;
}
