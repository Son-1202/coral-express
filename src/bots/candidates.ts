// Candidate actions for the greedy / bond-never bots, each with an estimated
// Δ Shells/s ("gain"), total plan cost and one-off request bonus. Structural candidates
// (fish, carriages, slots, decor, habitat, track, specials, moves) are cached per state
// signature; level candidates are cheap and computed analytically by the planner.
import type { Habitat, SpeciesDef } from '../data/schema';
import type { Action, Carriage, SimState } from '../sim';
import type { CarModel } from '../sim/income';
import { carriagePrice, copyCost, decorCost, habitatChangeCost, levelCost, slotCost, trackCost } from '../sim/costs';
import { habitatsForLine, stationId } from '../sim/lookup';
import type { RequestDef } from '../sim/story';
import { carValue, evalCar, rawFishValue, trackFareGain, type CarChange, type Econ } from './econ';
import type { BotRng } from './rng';
import { decorPlacement, trayDecor } from './util';

export type CandKind = 'buy' | 'replace' | 'carriage' | 'slot' | 'decor' | 'place' | 'habitat' | 'track' | 'special' | 'level' | 'move';

export interface Cand {
  kind: CandKind;
  /** Actions executed now. Multi-step plans (carriage/slot + fish) only run their first step. */
  actions: Action[];
  /** Total Shells of the plan (for scoring). Shells needed now = `now`. */
  cost: number;
  now: number;
  gain: number;
  bonus: number;
  /** level candidates: fish id + levels (virtual bookkeeping). */
  fishId?: string;
  levels?: number;
}

export interface PlanOpts {
  bonds: boolean;
  rng: BotRng;
}

/** Upper bound on bondMult (pair + community + decor/upgrade pp) for cheap pre-filters. */
const BOND_CEILING = 4;

interface ReqCtx { open: RequestDef[]; value: Map<string, number> }

function speciesOf(e: Econ, id: string): SpeciesDef {
  const sp = e.idx.species.get(id);
  if (!sp) throw new Error(`bot: unknown species ${id}`);
  return sp;
}

function openRequests(e: Econ): ReqCtx {
  const s = e.state;
  const done = new Set(s.requestsDoneThisRun);
  const open: RequestDef[] = [];
  const value = new Map<string, number>();
  for (let k = 1; k <= e.idx.data.config.stationsPerLine; k++) {
    const b = s.requestBoards[stationId(s.currentLine, k)];
    if (!b) continue;
    for (const id of b.ids) {
      const r = e.idx.requests.get(id);
      if (!r || done.has(id) || metNow(e, r)) continue;
      open.push(r);
      const rw = r.reward;
      let v = 0;
      if (rw.type === 'income' || rw.type === 'incomeCosmetic') v = rw.seconds * e.baseIncome;
      else if (rw.type === 'decor') v = e.idx.decor.get(rw.decorId)?.baseCost ?? 0;
      value.set(id, v);
    }
  }
  return { open, value };
}

function carMeets(e: Econ, r: RequestDef, car: Carriage, m: CarModel, s: SimState): boolean {
  const c = r.condition;
  switch (c.type) {
    case 'species': return car.fish.some((id) => (s.fish[id] ?? e.fishView[id])?.species === c.species);
    case 'community': return m.bonds.active.some((b) => b.kind === 'community' && b.bondId === c.community);
    case 'appeal': return m.appeal >= c.value - 1e-9;
    case 'decor':
      return c.items.length > 0 && c.items.every((it) =>
        car.decor.filter((d) => (it.decorId ? d.id === it.decorId : !!it.plantAny && !!e.idx.decor.get(d.id)?.isPlant)).length >= it.count);
    default: return false;
  }
}

function metNow(e: Econ, r: RequestDef): boolean {
  for (const car of e.state.carriages) {
    const m = e.model.byId.get(car.id);
    if (m && carMeets(e, r, car, m, e.state)) return true;
  }
  return false;
}

function hypCar(car: Carriage, ch: CarChange, newFishId: string): Carriage {
  let fish = car.fish;
  if (ch.removeFishId) fish = fish.filter((id) => id !== ch.removeFishId);
  if (ch.addSpecies) fish = [...fish, newFishId];
  const decor = ch.addDecor ? [...car.decor, { id: ch.addDecor, x: 0, y: 0, layer: 'back' as const, scale: 1, flip: false }] : car.decor;
  return { ...car, fish, decor, habitat: ch.habitat ?? car.habitat };
}

/** Value of a hypothetical car change: Δ Shells/s and request bonus. */
function delta(e: Econ, rq: ReqCtx, car: Carriage, ch: CarChange): { gain: number; bonus: number } {
  const cur = e.model.byId.get(car.id);
  const dd = ch.addDecor && !ch.addSpecies && !ch.removeFishId && !ch.habitat ? e.idx.decor.get(ch.addDecor) : undefined;
  // Decor without effects only adds appeal: no need to re-run the income model.
  const next = cur && dd && dd.effects.length === 0
    ? { ...cur, appeal: cur.appeal + dd.appeal }
    : evalCar(e, car, ch);
  const gain = carValue(e, next) - (cur ? carValue(e, cur) : 0);
  let bonus = 0;
  if (rq.open.length) {
    const hc = hypCar(car, ch, '__bot_new');
    for (const r of rq.open) if (carMeets(e, r, hc, next, e.state)) bonus += rq.value.get(r.id) ?? 0;
  }
  return { gain, bonus };
}

function emptyCar(habitat: Habitat, slots: number): Carriage {
  return { id: '__bot_car', habitat, slots, extraSlots: 0, fish: [], decor: [], cosmetics: { sand: '', backdrop: '', paint: '' }, heritage: false };
}

/** Species purchasable now (Catalogue + open fish stall). */
function availableSpecies(s: SimState): string[] {
  return [...new Set([...s.speciesBoughtThisRun, ...s.market.fish])];
}

/** Fish value inside its car model (Shells/s incl. appeal). */
function fishValue(e: Econ, m: CarModel, fishId: string): number {
  const f = m.fish.find((x) => x.fishId === fishId);
  return f ? f.sps * e.frenzyF + f.appeal * e.fpa : 0;
}

/** Best fish to put into `car` (or an empty car of `habitat`). Bond-never: raw output + habitat. */
function bestFishFor(e: Econ, rq: ReqCtx, o: PlanOpts, car: Carriage, species: string[], removeFishId?: string): { sp: string; gain: number; bonus: number; cost: number } | null {
  let best: { sp: string; gain: number; bonus: number; cost: number; score: number } | null = null;
  for (const id of species) {
    if (removeFishId && e.state.fish[removeFishId]?.species === id) continue;
    const sp = speciesOf(e, id);
    const cost = copyCost(e.idx, e.state, sp, e.fx);
    let d: { gain: number; bonus: number };
    if (car.fish.length === 0 && car.decor.length === 0) {
      // A lone fish has no bonds: the analytic value is exact (requests: species only).
      let bonus = 0;
      for (const r of rq.open) if (r.condition.type === 'species' && r.condition.species === id) bonus += rq.value.get(r.id) ?? 0;
      d = { gain: rawFishValue(e, sp, car.habitat), bonus: o.bonds ? bonus : 0 };
    } else if (o.bonds) d = delta(e, rq, car, { addSpecies: id, removeFishId });
    else {
      const cur = e.model.byId.get(car.id);
      const lost = removeFishId && cur ? fishValue(e, cur, removeFishId) : 0;
      d = { gain: rawFishValue(e, sp, car.habitat) - lost, bonus: 0 };
    }
    if (d.gain <= 0) continue;
    const score = d.gain / Math.max(1e-9, cost - d.bonus * 0.5 + 1);
    if (!best || score > best.score) best = { sp: id, ...d, cost, score };
  }
  return best;
}

export function structuralCandidates(e: Econ, o: PlanOpts): Cand[] {
  const s = e.state;
  const cfg = e.idx.data.config;
  const out: Cand[] = [];
  const rq = openRequests(e);
  const species = availableSpecies(s);
  const line = s.currentLine;
  const habitats = habitatsForLine(e.idx, line);
  const free = s.carriages.filter((c) => c.fish.length < c.slots);

  // Buy a fish into a car with a free slot.
  if (o.bonds) {
    for (const car of free) {
      for (const id of species) {
        const sp = speciesOf(e, id);
        const cost = copyCost(e.idx, s, sp, e.fx);
        const d = delta(e, rq, car, { addSpecies: id });
        if (d.gain > 0 || d.bonus > 0) out.push({ kind: 'buy', actions: [{ type: 'buyFish', species: id, carId: car.id }], cost, now: cost, ...d });
      }
    }
  } else if (free.length) {
    for (const id of species) {
      const sp = speciesOf(e, id);
      const home = free.filter((c) => c.habitat === sp.habitat);
      const car = o.rng.pick(home.length ? home : free)!;
      const cost = copyCost(e.idx, s, sp, e.fx);
      out.push({ kind: 'buy', actions: [{ type: 'buyFish', species: id, carId: car.id }], cost, now: cost, gain: rawFishValue(e, sp, car.habitat), bonus: 0 });
    }
  }

  // Replace the weakest (non-mascot) fish of a full car.
  for (const car of s.carriages) {
    if (car.fish.length < car.slots || car.fish.length === 0) continue;
    const m = e.model.byId.get(car.id);
    if (!m) continue;
    let weakest: string | null = null;
    let wv = Infinity;
    for (const id of car.fish) {
      if (s.fish[id]?.mascot) continue;
      const v = fishValue(e, m, id);
      if (v < wv) { wv = v; weakest = id; }
    }
    if (!weakest) continue;
    // Only species whose best-case output (habitat + full bond bonus) beats the weakest fish.
    const strong = species.filter((id) => rawFishValue(e, speciesOf(e, id), car.habitat) * BOND_CEILING > wv);
    if (!strong.length) continue;
    const b = bestFishFor(e, rq, o, car, strong, weakest);
    if (!b) continue;
    const refund = cfg.sellRefund * (s.fish[weakest]?.spent ?? 0);
    const net = b.cost - refund;
    out.push({
      kind: 'replace', actions: [{ type: 'sellFish', fishId: weakest }, { type: 'buyFish', species: b.sp, carId: car.id }],
      cost: Math.max(0, net), now: Math.max(0, net), gain: b.gain, bonus: b.bonus,
    });
  }

  // New carriage (+ its best fish, bought on a later step).
  if (s.carriages.length < cfg.maxCarriages) {
    const price = carriagePrice(e.idx, line, s.carriages.length + 1);
    const slots = Math.min(e.fx.startSlots ?? cfg.startSlots, cfg.maxSlots);
    for (const h of habitats) {
      const b = bestFishFor(e, rq, o, emptyCar(h, slots), species);
      if (!b) continue;
      out.push({ kind: 'carriage', actions: [{ type: 'buyCarriage', habitat: h }], cost: price + b.cost, now: price, gain: b.gain, bonus: b.bonus });
    }
  }

  // Extra slot (+ fish next step) for full cars; Today's Special free slot likewise.
  const sp = s.market.special;
  for (const [i, car] of s.carriages.entries()) {
    if (car.fish.length < car.slots || car.slots >= cfg.maxSlots) continue;
    const b = bestFishFor(e, rq, o, { ...car, slots: car.slots + 1 }, species);
    if (!b) continue;
    const price = slotCost(e.idx, line, i + 1, car.extraSlots);
    out.push({ kind: 'slot', actions: [{ type: 'buySlot', carId: car.id }], cost: price + b.cost, now: price, gain: b.gain, bonus: b.bonus });
    if (sp && !sp.sold && sp.kind === 'freeSlot') {
      out.push({ kind: 'special', actions: [{ type: 'buySpecial', target: car.id }], cost: sp.price + b.cost, now: sp.price, gain: b.gain, bonus: b.bonus });
    }
  }

  // Decor: place tray items for free, or buy stall / restock items.
  const tray = new Set(trayDecor(s));
  const decorIds = new Set([...tray, ...s.market.decor, ...Object.keys(s.decorOwned)]);
  for (const id of decorIds) {
    const d = e.idx.decor.get(id);
    if (!d) continue;
    const inTray = tray.has(id);
    const cost = inTray ? 0 : decorCost(e.idx, s, id);
    if (cost === null) continue;
    let best: { car: Carriage; gain: number; bonus: number } | null = null;
    for (const car of s.carriages) {
      const m = e.model.byId.get(car.id);
      if (!m || m.decorUsed + d.capacity > m.decorCapacity) continue;
      const dd = delta(e, rq, car, { addDecor: id });
      if (!best || dd.gain + dd.bonus * 1e-3 > best.gain + best.bonus * 1e-3) best = { car, ...dd };
    }
    if (!best || (best.gain <= 0 && best.bonus <= 0)) continue;
    const actions: Action[] = inTray
      ? [{ type: 'placeDecor', carId: best.car.id, decorId: id, ...decorPlacement(o.rng.next()) }]
      : [{ type: 'buyDecor', decorId: id }];
    out.push({ kind: inTray ? 'place' : 'decor', actions, cost, now: cost, gain: best.gain, bonus: best.bonus });
  }

  // Habitat change for cars holding off-habitat fish.
  for (const [i, car] of s.carriages.entries()) {
    const homes = new Set<Habitat>();
    for (const id of car.fish) {
      const f = s.fish[id];
      const fsp = f && e.idx.species.get(f.species);
      if (f && fsp && !f.mascot && fsp.habitat !== 'any' && fsp.habitat !== car.habitat && habitats.includes(fsp.habitat)) homes.add(fsp.habitat);
    }
    for (const h of homes) {
      const d = delta(e, rq, car, { habitat: h });
      if (d.gain <= 0) continue;
      const cost = habitatChangeCost(e.idx, line, i + 1);
      out.push({ kind: 'habitat', actions: [{ type: 'changeHabitat', carId: car.id, habitat: h }], cost, now: cost, ...d });
    }
  }

  // Track: fare gain + the next station's new species.
  if (s.builtTo < cfg.stationsPerLine) {
    const k = s.builtTo + 1;
    const price = trackCost(e.idx, line, k);
    let gain = trackFareGain(e);
    let cost = price;
    for (const nsp of e.idx.data.species) {
      if (nsp.line !== line || nsp.station !== k) continue;
      gain += rawFishValue(e, nsp, nsp.habitat === 'any' ? 'reef' : nsp.habitat);
      cost += nsp.baseCost * e.fx.speciesCostMult;
    }
    out.push({ kind: 'track', actions: [{ type: 'buildTrack' }], cost, now: price, gain, bonus: 0 });
  }

  // Today's Special: Shiny Egg (×3 appeal on the next copy of a species we buy) and level discount.
  if (sp && !sp.sold) {
    if (sp.kind === 'shinyEgg') {
      const target = s.market.fish[0] && !s.speciesBoughtThisRun.includes(s.market.fish[0]) ? s.market.fish[0] : s.speciesBoughtThisRun[s.speciesBoughtThisRun.length - 1];
      const tsp = target ? e.idx.species.get(target) : undefined;
      if (tsp) {
        const gain = (cfg.shinyAppealMult - 1) * tsp.appeal * (tsp.flags.appealCount ?? 1) * e.fpa;
        out.push({ kind: 'special', actions: [{ type: 'buySpecial', target: tsp.id }], cost: sp.price, now: sp.price, gain, bonus: 0 });
      }
    } else if (sp.kind === 'levelDiscount' && sp.species) {
      const dsp = e.idx.species.get(sp.species);
      let lvl = 0;
      for (const f of Object.values(s.fish)) if (f.species === sp.species) lvl = Math.max(lvl, f.level);
      if (dsp && lvl > 0) {
        const n = Math.min(cfg.todaysSpecial.levelDiscountCount, cfg.maxLevel - lvl);
        let save = 0;
        for (let i = 0; i < n; i++) save += levelCost(e.idx, dsp.baseCost, lvl + i) * cfg.todaysSpecial.levelDiscount;
        // Counted at half value: the savings only materialise if those levels are bought.
        if (save * 0.5 > sp.price) out.push({ kind: 'special', actions: [{ type: 'buySpecial' }], cost: sp.price, now: sp.price, gain: 0, bonus: save * 0.5 });
      }
    }
  }

  out.push(...moveCandidates(e, o));
  return out;
}

/** Free moves into cars with a free slot (greedy: bonds + habitat; bond-never: habitat only). */
function moveCandidates(e: Econ, o: PlanOpts): Cand[] {
  const s = e.state;
  const free = s.carriages.filter((c) => c.fish.length < c.slots);
  if (!free.length) return [];
  const out: Cand[] = [];
  const partners = bondPartners(e);
  for (const car of s.carriages) {
    const m = e.model.byId.get(car.id);
    if (!m) continue;
    for (const fi of m.fish) {
      const f = s.fish[fi.fishId];
      if (!f || f.mascot) continue;
      const sp = speciesOf(e, f.species);
      const off = fi.habitatMult < 1;
      if (!o.bonds && !off) continue;
      if (o.bonds && !off && fi.bondMult > 1) continue;
      for (const to of free) {
        if (to.id === car.id) continue;
        // Greedy: only worth a model run if it fixes the habitat or meets a bond partner.
        if (o.bonds && !(off && sp.habitat === to.habitat) && !(partners.get(f.species)?.some((p) => to.fish.some((id) => s.fish[id]?.species === p)))) continue;
        let gain: number;
        if (o.bonds) {
          const from = evalCar(e, car, { removeFishId: f.id });
          const tm = e.model.byId.get(to.id);
          const toNext = evalCar(e, { ...to, fish: [...to.fish, f.id] }, {});
          gain = carValue(e, from) + carValue(e, toNext) - carValue(e, m) - (tm ? carValue(e, tm) : 0);
        } else {
          if (sp.habitat !== to.habitat) continue;
          gain = fi.sps * (1 / fi.habitatMult - 1) * e.frenzyF + fi.appeal * (1 / fi.habitatMult - 1) * e.fpa;
        }
        if (gain > 1e-9 * (e.income + 1)) out.push({ kind: 'move', actions: [{ type: 'moveFish', fishId: f.id, carId: to.id }], cost: 0, now: 0, gain, bonus: 0 });
      }
    }
  }
  return out;
}

const partnerCache = new WeakMap<object, Map<string, string[]>>();
/** Species → species it bonds with (pairs and community co-members). */
function bondPartners(e: Econ): Map<string, string[]> {
  const b = e.idx.data.bonds;
  let m = partnerCache.get(b);
  if (m) return m;
  m = new Map();
  const add = (x: string, y: string): void => { const l = m!.get(x) ?? []; if (!l.includes(y)) l.push(y); m!.set(x, l); };
  for (const p of b.pairs) { add(p.a, p.b); add(p.b, p.a); }
  for (const c of b.communities) for (const x of c.members) for (const y of c.members) if (x !== y) add(x, y);
  partnerCache.set(b, m);
  return m;
}
