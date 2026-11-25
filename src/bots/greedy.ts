// Greedy and bond-never bots (SPEC E1). Each decision picks the candidate with the
// shortest payback time  T = wait + (cost − requestBonus) / ΔShells/s,  where wait is
// the time to afford it at the current income; it buys when affordable, else saves.
// Cheap level-ups are chained within one sim-second (virtual bookkeeping, same cost
// formulas as the sim). Feeds the best carriage every second, taps every Sight,
// buys Depot Upgrades in table order, resets when projected Tickets ≥ 2× total
// (≥ 3 on the first run), rides the newest Line, Mascot = highest-level fish.
import type { LineId } from '../data/schema';
import type { Action, Sim, SimState } from '../sim';
import { levelCost, milestoneMult } from '../sim/costs';
import { buildIndex } from '../sim/lookup';
import { structuralCandidates, type Cand, type PlanOpts } from './candidates';
import { snapshot, type CarCache, type Econ } from './econ';
import { botRng } from './rng';
import type { Bot, BotName, BotOptions } from './types';
import { canDo } from './util';

/** Max purchases chained in one decision (level-ups only, then at most one structural). */
const MAX_CHAIN = 25;
/** Structural candidates are re-evaluated at least this often (bond partners level up). */
const REFRESH_SECONDS = 120;
/** First Depot Reset needs at least this many Tickets (SPEC E1). */
const FIRST_RESET_TICKETS = 3;
/** Level bundle up to the next milestone is considered within this many levels. */
const MILESTONE_LOOKAHEAD = 15;
/** While saving for the terminal track, only buys that repay within this many seconds. */
const FORCED_PAYBACK = 120;

/**
 * T-20: the next track only pays off soon if it is built before the train leaves the last
 * built station (else it shuttles a whole round trip first). When the track is the best
 * structural plan and affordable by then, keep enough Shells for it. Returns the reserve.
 */
function trackReserve(s: SimState, structural: Cand[], income: number): number {
  const tr = s.train;
  const heading = (tr.phase === 'moving' && tr.toStation === s.builtTo) || (tr.phase === 'stopped' && tr.fromStation === s.builtTo);
  if (!heading || income <= 0) return 0;
  const track = structural.find((c) => c.kind === 'track');
  if (!track) return 0;
  const T = (c: Cand): number => (c.gain > 0 ? (c.cost - c.bonus) / c.gain : Infinity);
  // Worth it if it repays within TRACK_RESERVE_PAYBACK s or is the best structural plan.
  if (T(track) > TRACK_RESERVE_PAYBACK && structural.some((c) => c.kind !== 'track' && T(c) < T(track))) return 0;
  const left = tr.phase === 'moving' ? DEPART_GUESS.leg - tr.t + DEPART_GUESS.stop : DEPART_GUESS.stop - tr.t;
  const need = track.now - income * Math.max(0, left - 1);
  // Infeasible (already spent): don't hoard for a departure we'll miss anyway.
  return need <= s.shells ? Math.max(0, need) : 0;
}

/** Track payback (s) that is always worth catching the departure for. */
const TRACK_RESERVE_PAYBACK = 150;

/** Leg/stop seconds for the departure estimate (set from data when the bot is created). */
const DEPART_GUESS = { leg: 45, stop: 6 };

function signature(s: SimState): string {
  let sig = `${s.nextId}|${s.lifetime.arrivals}|${s.permanent.resets}|${s.builtTo}|${s.market.special?.sold ?? '-'}|${s.permanent.upgrades.length}`;
  for (const c of s.carriages) sig += `|${c.fish.length},${c.slots},${c.decor.length},${c.habitat}`;
  let d = 0;
  for (const v of Object.values(s.decorOwned)) d += v;
  return `${sig}|${d}`;
}

export function resetTarget(s: SimState): number {
  const total = s.permanent.totalTicketsEarned;
  return total === 0 ? FIRST_RESET_TICKETS : 2 * total;
}

/** T-20 (ticket direction 6): Mascot = highest-output fish (ties: higher level). */
export function pickMascot(sim: Sim): string | null {
  let best: string | null = null;
  let bv = -1;
  let bl = -1;
  for (const c of sim.state.carriages) {
    for (const fi of sim.carInfo(c.id).fish) {
      const lvl = sim.state.fish[fi.fishId]?.level ?? 0;
      if (fi.sps > bv || (fi.sps === bv && lvl > bl)) { best = fi.fishId; bv = fi.sps; bl = lvl; }
    }
  }
  return best;
}

/** Seconds the bot may wait at the terminal to afford its signature species before resetting. */
const TERMINAL_SPECIES_WAIT = 60;

/**
 * T-20: buy the terminal's signature species (first sale only there) before the reset,
 * if affordable within TERMINAL_SPECIES_WAIT s. Returns actions to buy now, 'wait', or null.
 */
function terminalSpecies(sim: Sim, idx: ReturnType<typeof buildIndex>): Action[] | 'wait' | null {
  const s = sim.state;
  const cfg = idx.data.config;
  const sig = idx.data.species.find((x) => x.line === s.currentLine && x.station === cfg.stationsPerLine);
  if (!sig || s.speciesBoughtThisRun.includes(sig.id) || !s.market.fish.includes(sig.id)) return null;
  const free = s.carriages.filter((c) => c.fish.length < c.slots);
  const car = free.find((c) => c.habitat === sig.habitat) ?? free[0];
  const out: Action[] = [];
  let carId = car?.id;
  let refund = 0;
  if (!carId) {
    let weakest: { id: string; car: string; sps: number; spent: number } | null = null;
    for (const c of s.carriages) {
      for (const fi of sim.carInfo(c.id).fish) {
        const f = s.fish[fi.fishId];
        if (f && !f.mascot && (!weakest || fi.sps < weakest.sps)) weakest = { id: f.id, car: c.id, sps: fi.sps, spent: f.spent };
      }
    }
    if (!weakest) return null;
    out.push({ type: 'sellFish', fishId: weakest.id });
    carId = weakest.car;
    refund = cfg.sellRefund * weakest.spent;
  }
  const buy: Action = { type: 'buyFish', species: sig.id, carId };
  const price = (sim.price(buy) ?? Infinity) - refund;
  if (price <= s.shells) return [...out, buy];
  const income = sim.stats().totalSps;
  return income > 0 && (price - s.shells) / income <= TERMINAL_SPECIES_WAIT ? 'wait' : null;
}

interface VirtualFish { level: number; sps0: number; level0: number }

export function createGreedyBot(opts: BotOptions, name: Extract<BotName, 'greedy' | 'bondNever'> = 'greedy'): Bot {
  const idx = buildIndex(opts.data, opts.story);
  const cfg = idx.data.config;
  const plan: PlanOpts = { bonds: name === 'greedy', rng: botRng(opts.seed) };
  const frenzyF = 1 + ((cfg.frenzy.mult - 1) * cfg.frenzy.seconds) / cfg.frenzy.cooldown;
  DEPART_GUESS.leg = cfg.legSeconds;
  DEPART_GUESS.stop = cfg.stopSeconds;
  let cache: { sig: string; t: number; cands: Cand[] } = { sig: '', t: -1e9, cands: [] };
  let waitFor = 0;
  let termWaitStart = -1;
  /** Per-fish level candidates, reused while level, discount and output are unchanged. */
  const levelCache = new Map<string, { key: string; cands: Cand[] }>();
  const carCache: CarCache = new Map();
  const pps = (sp: string): number => idx.species.get(sp)?.basePps ?? 0;

  function spsAt(v: VirtualFish, level: number): number {
    return v.sps0 * (level * milestoneMult(idx, level)) / (v.level0 * milestoneMult(idx, v.level0));
  }

  function levelCands(e: Econ, virt: Map<string, VirtualFish>, disc: Record<string, number>, only?: string): Cand[] {
    const out: Cand[] = [];
    const k = 1 - cfg.todaysSpecial.levelDiscount;
    for (const [id, v] of virt) {
      if (only && id !== only) continue;
      const f = e.state.fish[id];
      const sp = f && idx.species.get(f.species);
      if (!f || !sp || v.level >= cfg.maxLevel) continue;
      const left = disc[f.species] ?? 0;
      const key = `${v.level}|${left}|${spsAt(v, v.level)}`;
      const hit = levelCache.get(id);
      if (hit && hit.key === key) { out.push(...hit.cands); continue; }
      const mine: Cand[] = [];
      const costOf = (times: number): number => {
        let c = 0;
        for (let i = 0; i < times; i++) c += levelCost(idx, sp.baseCost, v.level + i) * (i < left ? k : 1);
        return c;
      };
      const base = spsAt(v, v.level);
      const add = (times: number): void => {
        const cost = costOf(times);
        const gain = (spsAt(v, v.level + times) - base) * e.frenzyF;
        mine.push({ kind: 'level', actions: [{ type: 'levelFish', fishId: id, times }], cost, now: cost, gain, bonus: 0, fishId: id, levels: times });
      };
      add(1);
      const m = cfg.milestones.levels.find((l) => l > v.level);
      if (m !== undefined && m - v.level > 1 && m - v.level <= MILESTONE_LOOKAHEAD) add(m - v.level);
      levelCache.set(id, { key, cands: mine });
      out.push(...mine);
    }
    return out;
  }

  function score(c: Cand, shells: number, income: number): number {
    const wait = c.now > shells ? (income > 0 ? (c.now - shells) / income : Infinity) : 0;
    const net = c.cost - c.bonus;
    if (net <= 0) return wait;
    if (c.gain <= 0) return Infinity;
    return wait + net / c.gain;
  }

  function purchases(sim: Sim, t: number): Action[] {
    const s = sim.state;
    const sig = signature(s);
    // Waiting for an unaffordable best plan: nothing can overtake it until the state
    // changes or it becomes affordable (affordable scores are fixed, waits shrink equally).
    if (sig === cache.sig && t - cache.t < REFRESH_SECONDS && s.shells < waitFor) return [];
    const e = snapshot(idx, s, frenzyF, carCache);
    if (sig !== cache.sig || t - cache.t >= REFRESH_SECONDS) cache = { sig, t, cands: structuralCandidates(e, plan) };
    let structural = cache.cands;
    // Reset-ready except for the terminal: the track is what matters now. Other purchases
    // only if they repay themselves within FORCED_PAYBACK s (they speed the track up).
    const forced = !s.terminalReachedThisRun && s.builtTo < cfg.stationsPerLine && s.runShells >= cfg.depotReset.minRunShells && sim.projectedTickets() >= resetTarget(s);
    const quick = (c: Cand): boolean => c.kind === 'track' || c.cost - c.bonus <= 0 || (c.gain > 0 && (c.cost - c.bonus) / c.gain <= FORCED_PAYBACK);
    if (forced) structural = structural.filter(quick);
    const virt = new Map<string, VirtualFish>();
    for (const cm of e.model.cars) {
      for (const fi of cm.fish) {
        const f = s.fish[fi.fishId];
        if (f && fi.sps > 0) virt.set(f.id, { level: f.level, level0: f.level, sps0: fi.sps });
      }
    }
    const disc = { ...s.levelDiscounts };
    const lv = (c: Cand[]): Cand[] => (forced ? c.filter(quick) : c);
    let levels = lv(levelCands(e, virt, disc));
    let shells = s.shells;
    const out: Action[] = [];
    // Conservative income (no frenzy) so the reserve is really there at departure.
    const reserve = trackReserve(s, structural, e.baseIncome * 0.8);
    for (let n = 0; n < MAX_CHAIN; n++) {
      let best: Cand | null = null;
      let bt = Infinity;
      // While reserving for a departure-critical track, only the track or buys that keep the reserve.
      const ok = (c: Cand): boolean => reserve <= 0 || c.kind === 'track' || shells - c.now >= reserve;
      for (const c of structural) { if (!ok(c)) continue; const v = score(c, shells, e.income); if (v < bt) { bt = v; best = c; } }
      for (const c of levels) { if (!ok(c)) continue; const v = score(c, shells, e.income); if (v < bt) { bt = v; best = c; } }
      if (!best || best.now > shells) {
        // T-20: saving for a level bundle (to the next milestone) — buy the affordable part now;
        // it is the same spend in the same order, so the plan is unchanged but the player acts.
        if (best && best.kind === 'level' && best.fishId && best.levels && best.levels > 1) {
          const f = s.fish[best.fishId]!;
          const sp = idx.species.get(f.species)!;
          const v = virt.get(best.fishId)!;
          let k = 0;
          let c = 0;
          while (k < best.levels - 1 && c + levelCost(idx, sp.baseCost, v.level + k) <= shells) { c += levelCost(idx, sp.baseCost, v.level + k); k++; }
          if (k > 0) { out.push({ type: 'levelFish', fishId: best.fishId, times: k }); break; }
        }
        if (n === 0) waitFor = best ? best.now : Infinity;
        break;
      }
      out.push(...best.actions);
      shells -= best.now;
      if (best.kind !== 'level' || !best.fishId || !best.levels) break;
      const v = virt.get(best.fishId)!;
      const f = s.fish[best.fishId]!;
      const left = disc[f.species];
      if (left !== undefined) { if (left > best.levels) disc[f.species] = left - best.levels; else delete disc[f.species]; }
      v.level += best.levels;
      // Discounts are per species: refresh every fish of that species; others are unchanged.
      levels = levels.filter((c) => c.fishId !== best!.fishId && s.fish[c.fishId!]?.species !== f.species);
      for (const [id] of virt) if (s.fish[id]?.species === f.species) levels.push(...lv(levelCands(e, virt, disc, id)));
    }
    if (out.length) waitFor = 0; // re-plan next second (structural buys change the signature)
    return out;
  }

  function feedBest(sim: Sim): Action | null {
    const s = sim.state;
    let best: { id: string; v: number } | null = null;
    for (const c of s.carriages) {
      const fr = s.frenzy[c.id];
      if (fr && s.time < fr.cooldownUntil) continue;
      let v = 0;
      for (const id of c.fish) { const f = s.fish[id]; if (f) v += pps(f.species) * f.level; }
      if (v > 0 && (!best || v > best.v)) best = { id: c.id, v };
    }
    if (!best) return null;
    const a: Action = { type: 'feed', carId: best.id };
    return canDo(sim, a) ? a : null;
  }

  return {
    name,
    decide(sim, t) {
      const s = sim.state;
      const out: Action[] = [];
      const next = idx.data.upgrades.find((u) => !s.permanent.upgrades.includes(u.id));
      // Upgrades change prices/effects: no other purchase in the same second.
      const upgrading = !!next && canDo(sim, { type: 'buyUpgrade', id: next.id });
      if (next && upgrading) out.push({ type: 'buyUpgrade', id: next.id });
      if (sim.canDepotReset() && sim.projectedTickets() >= resetTarget(s)) {
        const ts = upgrading ? null : terminalSpecies(sim, idx);
        if (ts === 'wait') { if (termWaitStart < 0) termWaitStart = t; }
        if (ts !== 'wait' || t - termWaitStart > TERMINAL_SPECIES_WAIT) {
          if (Array.isArray(ts)) { out.push(...ts); return out; }
          const mascot = pickMascot(sim);
          const line = Math.max(...s.permanent.openedLines) as LineId;
          if (mascot) { termWaitStart = -1; out.push({ type: 'depotReset', mascotFishId: mascot, nextLine: line }); return out; }
        } else {
          const feedW = feedBest(sim);
          if (feedW) out.push(feedW);
          return out;
        }
      }
      const sight = s.sight.active;
      let tapped = false;
      if (sight?.requiresTap && canDo(sim, { type: 'tapSight' })) { out.push({ type: 'tapSight' }); tapped = sight.id === 'stowaway'; }
      const feed = feedBest(sim);
      if (feed) out.push(feed);
      // A Stowaway tap takes a free slot, so purchases wait one second.
      if (!tapped && !upgrading) out.push(...purchases(sim, t));
      return out;
    },
  };
}
