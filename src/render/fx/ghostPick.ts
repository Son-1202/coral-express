/**
 * T-27: which missing partner a carriage hints at (at most one "ghost" per car), and the
 * tooltip text explaining it. Pure: reads only the sim's `possibleBonds` and bonds data.
 */
import type { BondsData, SpeciesDef } from '../../data/schema';
import type { PossibleBond } from '../../sim/types';

export interface GhostHint {
  /** Species the player could add. */
  missing: string;
  /** A present species this hint is about (pair partner first, else a community member). */
  anchor: string;
  /** Pair partners the new fish would bond with, with their bonus (fraction). */
  pairs: { partner: string; bonus: number }[];
  /** Communities the new fish would complete, with their bonus (fraction). */
  communities: { name: string; bonus: number }[];
  /** Summed bonus fractions (ranking key). */
  value: number;
}

/**
 * The most valuable bond that is exactly one fish short, grouped by the missing species
 * (a pair and a community waiting for the same fish make one hint). Ties keep sim order.
 */
export function pickGhost(possible: readonly PossibleBond[], bonds: BondsData, communityBonus: number): GhostHint | null {
  const by = new Map<string, GhostHint>();
  for (const b of possible) {
    if (b.missing.length !== 1) continue;
    const missing = b.missing[0] as string;
    const present = b.present[0];
    if (!present) continue;
    let h = by.get(missing);
    if (!h) by.set(missing, (h = { missing, anchor: present, pairs: [], communities: [], value: 0 }));
    if (b.kind === 'pair') {
      const def = bonds.pairs.find((p) => `${p.a}+${p.b}` === b.bondId);
      const bonus = def?.bonus ?? 0;
      if (!h.pairs.length) h.anchor = present;
      h.pairs.push({ partner: present, bonus });
      h.value += bonus;
    } else {
      const name = bonds.communities.find((c) => c.id === b.bondId)?.name ?? b.bondId;
      h.communities.push({ name, bonus: communityBonus });
      h.value += communityBonus;
    }
  }
  let best: GhostHint | null = null;
  for (const h of by.values()) if (!best || h.value > best.value) best = h;
  return best;
}

const pct = (f: number) => `+${Math.round(f * 100)}%`;
const article = (name: string) => (/^[aeiou]/i.test(name) ? 'an' : 'a');

/** e.g. "Add a Watchman Goby to bond with Pistol Shrimp (+100%) and complete the Mangrove Crew (+200%)". */
export function ghostText(h: GhostHint, species: readonly Pick<SpeciesDef, 'id' | 'name'>[]): string {
  const name = (id: string) => species.find((s) => s.id === id)?.name ?? id;
  const who = name(h.missing);
  const parts: string[] = [];
  if (h.pairs.length) parts.push(`bond with ${h.pairs.map((p) => `${name(p.partner)} (${pct(p.bonus)})`).join(' and ')}`);
  for (const c of h.communities) parts.push(`complete the ${c.name} (${pct(c.bonus)})`);
  return `Add ${article(who)} ${who} to ${parts.join(' and ')}`;
}
