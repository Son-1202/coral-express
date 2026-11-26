import type { GameData } from '../data/schema';
import type { Carriage, SimState } from '../sim';

/** Extra bond bonus (fractions, "percentage points") on top of bonds.json / config.communityBonus. */
export interface BondPP {
  /** Added to pair bonuses: decor `bondBonusPP` + upgrade `pairBonusPP` (e.g. Matchmaker). */
  pair: number;
  /** Added to the community bonus: decor `bondBonusPP` + upgrade `communityBonusPP`. */
  community: number;
}

/**
 * T-40: the decor + upgrade pp a carriage's bonds get — one source for the market estimate
 * (`ui/helpers.fishGainWithBonds`) and the missing-partner tooltip, so they always agree.
 * Each decor id counts once per carriage (same rule as the sim).
 */
export function bondPP(data: GameData, state: SimState, car: Pick<Carriage, 'decor'> | null): BondPP {
  let decor = 0;
  const seen = new Set<string>();
  for (const d of car?.decor ?? []) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    for (const e of data.decor.find((x) => x.id === d.id)?.effects ?? []) if (e.type === 'bondBonusPP') decor += e.value;
  }
  let pair = 0;
  let community = 0;
  for (const u of data.upgrades) {
    if (!state.permanent.upgrades.includes(u.id)) continue;
    for (const e of u.effects) {
      if (e.type === 'pairBonusPP') pair += e.value;
      else if (e.type === 'communityBonusPP') community += e.value;
    }
  }
  return { pair: decor + pair, community: decor + community };
}
