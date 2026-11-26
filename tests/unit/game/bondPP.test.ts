import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { bondPP } from '../../../src/game/bondPP';
import { ghostText, pickGhost } from '../../../src/render/fx/ghostPick';
import type { PossibleBond } from '../../../src/sim/types';
import type { SimState } from '../../../src/sim';

const data = loadGameData();
const state = (upgrades: string[]) => ({ permanent: { upgrades } }) as unknown as SimState;
const decorWith = data.decor.find((d) => d.effects.some((e) => e.type === 'bondBonusPP'));
const pairUp = data.upgrades.find((u) => u.effects.some((e) => e.type === 'pairBonusPP'));

describe('bond pp for the missing-partner tooltip (T-40)', () => {
  it('sums decor (once per id) and upgrade pp', () => {
    expect(bondPP(data, state([]), null)).toEqual({ pair: 0, community: 0 });
    if (!decorWith || !pairUp) throw new Error('data has no bondBonusPP decor / pairBonusPP upgrade');
    const dv = decorWith.effects.filter((e) => e.type === 'bondBonusPP').reduce((a, e) => a + e.value, 0);
    const uv = pairUp.effects.filter((e) => e.type === 'pairBonusPP').reduce((a, e) => a + e.value, 0);
    const car = { decor: [{ id: decorWith.id }, { id: decorWith.id }] } as never;
    const pp = bondPP(data, state([pairUp.id]), car);
    expect(pp.pair).toBeCloseTo(dv + uv);
    expect(pp.community).toBeCloseTo(dv + pairUp.effects.filter((e) => e.type === 'communityBonusPP').reduce((a, e) => a + e.value, 0));
  });

  it('tooltip % includes the pp', () => {
    const possible: PossibleBond[] = [{ kind: 'pair', bondId: 'clownfish+carpet_anemone', present: ['clownfish'], missing: ['carpet_anemone'] }];
    const h = pickGhost(possible, data.bonds, data.config.communityBonus, { pair: 0.25, community: 0 });
    expect(ghostText(h!, data.species)).toBe('Add a Carpet Anemone to bond with Clownfish (+125%)');
  });
});
