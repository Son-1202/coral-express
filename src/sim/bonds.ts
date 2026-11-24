// Bond resolution for one carriage (SPEC B4.6). Deterministic: pairs are matched in
// bonds.json order, fish in slot order; a fish counts toward at most one pair.
// Communities (all three species in the car) add their bonus to the three member fish
// only (D-018: first fish of each member species in slot order) and keep their pairs;
// the +appeal applies to the car.
import type { DataIndex } from './lookup';
import type { BondInfo, Fish, PossibleBond } from './types';
import type { UpgradeFx } from './upgrades';

export interface CarBonds {
  active: BondInfo[];
  possible: PossibleBond[];
  /** Bond bonus per fish id (fraction; bondMult = 1 + value). */
  fishBonus: Map<string, number>;
  /** Extra appeal from active communities. */
  communityAppeal: number;
}

export function resolveBonds(idx: DataIndex, fish: readonly Fish[], decorBondPP: number, fx: UpgradeFx): CarBonds {
  const cfg = idx.data.config;
  const active: BondInfo[] = [];
  const possible: PossibleBond[] = [];
  const fishBonus = new Map<string, number>();
  for (const f of fish) fishBonus.set(f.id, 0);
  const paired = new Set<string>();
  const present = new Set(fish.map((f) => f.species));

  for (const p of idx.data.bonds.pairs) {
    if (!present.has(p.a) && !present.has(p.b)) continue;
    const as = fish.filter((f) => f.species === p.a && !paired.has(f.id));
    const bs = fish.filter((f) => f.species === p.b && !paired.has(f.id));
    const n = Math.min(as.length, bs.length);
    const bonus = p.bonus + decorBondPP + fx.pairBonusPP;
    for (let i = 0; i < n; i++) {
      const fa = as[i]!;
      const fb = bs[i]!;
      paired.add(fa.id);
      paired.add(fb.id);
      fishBonus.set(fa.id, (fishBonus.get(fa.id) ?? 0) + bonus);
      fishBonus.set(fb.id, (fishBonus.get(fb.id) ?? 0) + bonus);
      active.push({ kind: 'pair', bondId: `${p.a}+${p.b}`, species: [p.a, p.b], fishIds: [fa.id, fb.id], bonus });
    }
    // A leftover fish whose partner species is absent from the car → possible bond.
    if (as.length > n && !present.has(p.b)) possible.push({ kind: 'pair', bondId: `${p.a}+${p.b}`, present: [p.a], missing: [p.b] });
    if (bs.length > n && !present.has(p.a)) possible.push({ kind: 'pair', bondId: `${p.a}+${p.b}`, present: [p.b], missing: [p.a] });
  }

  let communityAppeal = 0;
  for (const c of idx.data.bonds.communities) {
    const have = c.members.filter((m) => present.has(m));
    if (have.length === 0) continue;
    if (have.length < c.members.length) {
      possible.push({ kind: 'community', bondId: c.id, present: have, missing: c.members.filter((m) => !present.has(m)) });
      continue;
    }
    const bonus = cfg.communityBonus + decorBondPP + fx.communityBonusPP;
    const ids = c.members.map((m) => fish.find((f) => f.species === m)!.id);
    for (const id of ids) fishBonus.set(id, (fishBonus.get(id) ?? 0) + bonus);
    communityAppeal += cfg.communityAppeal;
    active.push({ kind: 'community', bondId: c.id, species: [...c.members], fishIds: ids, bonus });
  }
  return { active, possible, fishBonus, communityAppeal };
}

/** Stable key used to diff bonds between recomputations (bondFormed / bondBroken). */
export function bondKey(carId: string, b: BondInfo): string {
  return `${carId}|${b.kind}|${b.bondId}|${b.fishIds.join(',')}`;
}
