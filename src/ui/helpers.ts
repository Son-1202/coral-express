// Pure UI helpers (no DOM). Unit-tested in tests/unit/ui/helpers.test.ts.
import type { GameData, SpeciesDef, UpgradeDef } from '../data/schema';
import type { CarInfo, Carriage, DepotPreview, SimState } from '../sim';

/** Seconds until `cost` is affordable at `sps`: 0 = now, null = never (no income). */
export function affordableIn(cost: number, shells: number, sps: number): number | null {
  if (!(cost > shells)) return 0;
  if (!(sps > 0)) return null;
  return (cost - shells) / sps;
}

/** Compact duration: 42 s, 3 m 05 s → "3m 5s", "2h 14m", "1d 3h". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

/** "in 42 s" label for an unaffordable item; '' when affordable; '—' when unreachable. */
export function waitLabel(cost: number, shells: number, sps: number): string {
  const t = affordableIn(cost, shells, sps);
  if (t === 0) return '';
  if (t === null || t > 99 * 86400) return 'save up';
  return `in ${formatDuration(Math.ceil(t))}`;
}

/** Species that bond with `speciesId` (pair partners + community co-members), in data order. */
export function partnersOf(data: GameData, speciesId: string): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (id !== speciesId && !out.includes(id)) out.push(id);
  };
  for (const p of data.bonds.pairs) {
    if (p.a === speciesId) add(p.b);
    else if (p.b === speciesId) add(p.a);
  }
  for (const c of data.bonds.communities) if (c.members.includes(speciesId)) c.members.forEach(add);
  return out;
}

function speciesInCar(state: SimState, carId: string): string[] {
  const car = state.carriages.find((c) => c.id === carId);
  return car ? car.fish.map((id) => state.fish[id]?.species).filter((s): s is string => !!s) : [];
}

/**
 * Default carriage for a new fish: among cars with a free slot, prefer
 * (1) the most bond partners already aboard, then (2) home habitat, then (3) train order.
 * Returns null when no car has a free slot.
 */
export function defaultTargetCar(state: SimState, data: GameData, speciesId: string): string | null {
  const sp = data.species.find((s) => s.id === speciesId);
  const partners = partnersOf(data, speciesId);
  let best: string | null = null;
  let bestScore = -1;
  for (const car of state.carriages) {
    if (car.fish.length >= car.slots) continue;
    const here = speciesInCar(state, car.id);
    const bonds = partners.filter((p) => here.includes(p)).length;
    const home = sp && (sp.habitat === 'any' || sp.flags.alwaysHome || sp.habitat === car.habitat) ? 1 : 0;
    const score = bonds * 10 + home * 2;
    if (score > bestScore) {
      best = car.id;
      bestScore = score;
    }
  }
  return best;
}

/** Global income multiplier from Tickets (+ Old Friend). */
export function globalMult(data: GameData, state: SimState): number {
  const c = data.config;
  const t = 1 + c.ticketIncomePerTicket * state.permanent.totalTicketsEarned;
  return state.permanent.oldFriend ? t * (1 + c.mascot.oldFriendBonus) : t;
}

/** Estimated Shells/s a fresh level-1 fish adds in a car of `habitat` (before bonds). */
export function fishGain(data: GameData, state: SimState, sp: SpeciesDef, habitat: string | null): number {
  const home = !habitat || sp.habitat === 'any' || sp.flags.alwaysHome || sp.habitat === habitat;
  return sp.basePps * (home ? 1 : data.config.offHabitatMult) * globalMult(data, state);
}

/** Player-facing one-liner for a Depot upgrade, derived from its effects. */
export function describeUpgrade(u: UpgradeDef): string {
  const parts = u.effects.map((e) => {
    switch (e.type) {
      case 'offline':
        return `Offline earnings ${Math.round(e.rate * 100)}% for up to ${e.capHours} h`;
      case 'startShellsPerTicket':
        return `Start each run with +${e.value} Shells per Ticket`;
      case 'legSeconds':
        return `Legs take ${e.value} s`;
      case 'speciesCostMult':
        return `Fish cost ${Math.round((1 - e.value) * 100)}% less`;
      case 'startSlots':
        return `Carriages start with ${e.value} slots`;
      case 'sightFrequencyMult':
        return `Sights appear ${e.value}× as often`;
      case 'fareMult':
        return `Fares ×${e.value}`;
      case 'pairBonusPP':
        return `Pair bonds +${Math.round(e.value * 100)} pp`;
      case 'communityBonusPP':
        return `Communities +${Math.round(e.value * 100)} pp`;
      default:
        return '';
    }
  });
  return parts.filter(Boolean).join(' · ');
}

/** Default Mascot name: nickname, else species name. */
export function defaultMascotName(data: GameData, species: string, nickname?: string): string {
  if (nickname) return nickname;
  return data.species.find((s) => s.id === species)?.name ?? 'Buddy';
}

/** Stations progress (0..1) of the train leg + seconds to arrival. */
export function legProgress(state: SimState, legSeconds: number, stopSeconds: number): { progress: number; eta: number; atStation: boolean } {
  const tr = state.train;
  if (tr.phase === 'stopped') return { progress: 1, eta: Math.max(0, stopSeconds - tr.t) + legSeconds, atStation: true };
  const p = legSeconds > 0 ? Math.min(1, tr.t / legSeconds) : 1;
  return { progress: p, eta: Math.max(0, legSeconds - tr.t), atStation: false };
}

/** Habitats buyable on a line: its own plus every earlier line's (sim rule 9). */
export function lineHabitats(data: GameData, line: number): string[] {
  const out: string[] = [];
  for (const l of data.lines) if (l.id <= line) for (const hb of l.habitats) if (!out.includes(hb)) out.push(hb);
  return out;
}

export interface DepotCheckRow {
  ok: boolean;
  text: string;
}

export interface DepotChecklist {
  /** The two reset conditions (terminal this run, run Shells), each ✓/✗. */
  rows: DepotCheckRow[];
  /** "Reset now: +N Tickets · income ×A → ×B · next Ticket at X Shells" (or "When ready: …"). */
  summary: string;
  /** Short reason the button is disabled (null when a reset is allowed). */
  blocked: string | null;
}

/**
 * T-33: Depot Reset checklist from the sim's `depotPreview()`. All numbers come from the sim;
 * `stationLabel(index)` names a station of the current Line.
 */
export function depotChecklist(pv: DepotPreview, fmt: (n: number) => string, stationLabel: (index: number) => string): DepotChecklist {
  const t = pv.terminalStation;
  const far = pv.terminalReached ? t : pv.furthestStation;
  const term: DepotCheckRow = {
    ok: pv.terminalReached,
    text: `Reach the terminal (Station ${t} · ${stationLabel(t)}) this run` + (pv.terminalReached ? '' : ` — furthest so far: Station ${far} · ${stationLabel(far)}`),
  };
  const shells: DepotCheckRow = {
    ok: pv.runShells >= pv.minRunShells,
    text: `Earn ${fmt(pv.minRunShells)} Shells this run: ${fmt(pv.runShells)} / ${fmt(pv.minRunShells)}`,
  };
  const n = pv.tickets;
  const grant = `+${fmt(n)} Ticket${n === 1 ? '' : 's'}`;
  const summary = `${pv.eligible ? 'Reset now' : 'When ready'}: ${grant} · income ×${pv.incomeMult.toFixed(1)} → ×${pv.incomeMultAfter.toFixed(1)} · next Ticket at ${fmt(pv.nextTicketAt)} Shells`;
  const missing = [term, shells].filter((r) => !r.ok).map((r) => (r === term ? `reach Station ${t}` : `earn ${fmt(pv.minRunShells - pv.runShells)} more Shells this run`));
  return { rows: [term, shells], summary, blocked: pv.eligible ? null : `To reset: ${missing.join(' and ')}.` };
}

export interface GainEstimate {
  /** Estimated Shells/s the train gains (new fish + the partners its bond boosts). */
  sps: number;
  /** Name of the bond this purchase would complete (partner species or community), else null. */
  bond: string | null;
}

/**
 * Like `fishGain`, plus the pair / community this fish would complete in `car` (from the sim's
 * `carInfo().possibleBonds`): the bond bonus applies to the new fish and to the partners it bonds with.
 */
export function fishGainWithBonds(data: GameData, state: SimState, sp: SpeciesDef, car: Carriage | null, info: CarInfo | null): GainEstimate {
  const base = fishGain(data, state, sp, car?.habitat ?? null);
  if (!car || !info) return { sps: base, bond: null };
  let decorPP = 0;
  const seen = new Set<string>();
  for (const d of car.decor) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    for (const e of data.decor.find((x) => x.id === d.id)?.effects ?? []) if (e.type === 'bondBonusPP') decorPP += e.value;
  }
  let pairPP = 0;
  let commPP = 0;
  for (const u of data.upgrades) {
    if (!state.permanent.upgrades.includes(u.id)) continue;
    for (const e of u.effects) {
      if (e.type === 'pairBonusPP') pairPP += e.value;
      else if (e.type === 'communityBonusPP') commPP += e.value;
    }
  }
  /** A fish's Shells/s before its current bonds. */
  const raw = (f: { sps: number; bondMult: number } | undefined) => (f ? f.sps / (f.bondMult || 1) : 0);
  const name = (id: string) => data.species.find((s) => s.id === id)?.name ?? id;
  let sps = base;
  const bonds: string[] = [];

  // pairs are matched in bonds.json order; the new fish joins the first pair waiting for it
  const pair = info.possibleBonds.find((b) => b.kind === 'pair' && b.missing.includes(sp.id));
  if (pair) {
    const def = data.bonds.pairs.find((p) => `${p.a}+${p.b}` === pair.bondId);
    const bonus = (def?.bonus ?? 0) + decorPP + pairPP;
    const paired = new Set(info.activeBonds.filter((b) => b.kind === 'pair').flatMap((b) => b.fishIds));
    const partner = pair.present[0] ?? '';
    const mate = info.fish.find((f) => f.species === partner && !paired.has(f.fishId));
    sps += bonus * (base + raw(mate));
    bonds.push(name(partner));
  }
  const comm = info.possibleBonds.find((b) => b.kind === 'community' && b.missing.length === 1 && b.missing[0] === sp.id);
  if (comm) {
    const bonus = data.config.communityBonus + decorPP + commPP;
    let members = base;
    for (const m of comm.present) members += raw(info.fish.find((f) => f.species === m));
    sps += bonus * members;
    bonds.push(data.bonds.communities.find((c) => c.id === comm.bondId)?.name ?? comm.bondId);
  }
  return { sps, bond: bonds.length ? bonds.join(' + ') : null };
}

/** T-24: locked-Line hint from the two-run unlock rule, e.g. "Reach the Sunny Coast terminal twice to open the Fog Fjords (1/2)". */
export function lineLockText(data: GameData, state: SimState, lineId: number): string {
  const l = data.lines.find((x) => x.id === lineId);
  if (!l || l.opensAfter == null) return 'Locked';
  const prev = data.lines.find((x) => x.id === l.opensAfter);
  const need = l.opensAfterRuns ?? 1;
  const done = Math.min(need, state.permanent.terminalRuns[String(l.opensAfter)] ?? 0);
  const times = need === 1 ? 'once' : need === 2 ? 'twice' : `${need} times`;
  return `Reach the ${prev?.region ?? `Line ${l.opensAfter}`} terminal ${times} to open the ${l.region} (${done}/${need})`;
}
