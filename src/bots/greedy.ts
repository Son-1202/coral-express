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
import { snapshot, type Econ } from './econ';
import { botRng } from './rng';
import type { Bot, BotName, BotOptions } from './types';
import { canDo } from './util';

/** Max purchases chained in one decision (level-ups only, then at most one structural). */
const MAX_CHAIN = 25;
/** Structural candidates are re-evaluated at least this often (bond partners level up). */
const REFRESH_SECONDS = 30;
/** First Depot Reset needs at least this many Tickets (SPEC E1). */
const FIRST_RESET_TICKETS = 3;
/** Level bundle up to the next milestone is considered within this many levels. */
const MILESTONE_LOOKAHEAD = 15;
/** While saving for the terminal track, only buys that repay within this many seconds. */
const FORCED_PAYBACK = 120;

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

/** Highest-level fish (ties: higher basePps). */
export function pickMascot(sim: Sim, basePps: (species: string) => number): string | null {
  let best: string | null = null;
  let bl = -1;
  let bp = -1;
  for (const f of Object.values(sim.state.fish)) {
    const p = basePps(f.species);
    if (f.level > bl || (f.level === bl && p > bp)) { best = f.id; bl = f.level; bp = p; }
  }
  return best;
}

interface VirtualFish { level: number; sps0: number; level0: number }

export function createGreedyBot(opts: BotOptions, name: Extract<BotName, 'greedy' | 'bondNever'> = 'greedy'): Bot {
  const idx = buildIndex(opts.data, opts.story);
  const cfg = idx.data.config;
  const plan: PlanOpts = { bonds: name === 'greedy', rng: botRng(opts.seed) };
  const frenzyF = 1 + ((cfg.frenzy.mult - 1) * cfg.frenzy.seconds) / cfg.frenzy.cooldown;
  let cache: { sig: string; t: number; cands: Cand[] } = { sig: '', t: -1e9, cands: [] };
  let waitFor = 0;
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
      const costOf = (times: number): number => {
        let c = 0;
        for (let i = 0; i < times; i++) c += levelCost(idx, sp.baseCost, v.level + i) * (i < left ? k : 1);
        return c;
      };
      const base = spsAt(v, v.level);
      const add = (times: number): void => {
        const cost = costOf(times);
        const gain = (spsAt(v, v.level + times) - base) * e.frenzyF;
        out.push({ kind: 'level', actions: [{ type: 'levelFish', fishId: id, times }], cost, now: cost, gain, bonus: 0, fishId: id, levels: times });
      };
      add(1);
      const m = cfg.milestones.levels.find((l) => l > v.level);
      if (m !== undefined && m - v.level > 1 && m - v.level <= MILESTONE_LOOKAHEAD) add(m - v.level);
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
    const e = snapshot(idx, s, frenzyF);
    if (sig !== cache.sig || t - cache.t >= REFRESH_SECONDS) cache = { sig, t, cands: structuralCandidates(e, plan) };
    let structural = cache.cands;
    // Reset-ready except for the terminal: the track is what matters now. Other purchases
    // only if they repay themselves within FORCED_PAYBACK s (they speed the track up).
    const forced = !s.terminalReachedThisRun && s.runShells >= cfg.depotReset.minRunShells && sim.projectedTickets() >= resetTarget(s);
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
    for (let n = 0; n < MAX_CHAIN; n++) {
      let best: Cand | null = null;
      let bt = Infinity;
      for (const c of structural) { const v = score(c, shells, e.income); if (v < bt) { bt = v; best = c; } }
      for (const c of levels) { const v = score(c, shells, e.income); if (v < bt) { bt = v; best = c; } }
      if (!best || best.now > shells) {
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
      if (next && canDo(sim, { type: 'buyUpgrade', id: next.id })) out.push({ type: 'buyUpgrade', id: next.id });
      if (sim.canDepotReset() && sim.projectedTickets() >= resetTarget(s)) {
        const mascot = pickMascot(sim, pps);
        const line = Math.max(...s.permanent.openedLines) as LineId;
        if (mascot) { out.push({ type: 'depotReset', mascotFishId: mascot, nextLine: line }); return out; }
      }
      const sight = s.sight.active;
      let tapped = false;
      if (sight?.requiresTap && canDo(sim, { type: 'tapSight' })) { out.push({ type: 'tapSight' }); tapped = sight.id === 'stowaway'; }
      const feed = feedBest(sim);
      if (feed) out.push(feed);
      // A Stowaway tap takes a free slot, so purchases wait one second.
      if (!tapped && out.every((a) => a.type !== 'buyUpgrade')) out.push(...purchases(sim, t));
      return out;
    },
  };
}
