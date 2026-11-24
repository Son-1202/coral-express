// Pure UI helpers (no DOM). Unit-tested in tests/unit/ui/helpers.test.ts.
import type { GameData, SpeciesDef, UpgradeDef } from '../data/schema';
import type { SimState } from '../sim';

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
