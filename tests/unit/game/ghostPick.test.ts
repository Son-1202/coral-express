import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { ghostText, pickGhost } from '../../../src/render/fx/ghostPick';
import type { PossibleBond } from '../../../src/sim/types';

const data = loadGameData();
const cb = data.config.communityBonus;

describe('missing-partner ghost pick (T-27)', () => {
  it('a pair and a community waiting for the same fish make ONE hint', () => {
    // producer case: mudskipper + pistol shrimp in a car
    const possible: PossibleBond[] = [
      { kind: 'pair', bondId: 'pistol_shrimp+watchman_goby', present: ['pistol_shrimp'], missing: ['watchman_goby'] },
      { kind: 'community', bondId: 'mangrove_crew', present: ['mudskipper', 'pistol_shrimp'], missing: ['watchman_goby'] },
    ];
    const h = pickGhost(possible, data.bonds, cb);
    expect(h?.missing).toBe('watchman_goby');
    expect(h?.anchor).toBe('pistol_shrimp');
    expect(h?.pairs).toHaveLength(1);
    expect(h?.communities).toHaveLength(1);
    expect(ghostText(h!, data.species)).toBe(
      `Add a Watchman Goby to bond with Pistol Shrimp (+100%) and complete the Mangrove Crew (+${Math.round(cb * 100)}%)`,
    );
  });

  it('picks the most valuable missing partner', () => {
    const possible: PossibleBond[] = [
      { kind: 'pair', bondId: 'garibaldi+kelp_seahorse', present: ['garibaldi'], missing: ['kelp_seahorse'] },
      { kind: 'pair', bondId: 'clownfish+carpet_anemone', present: ['clownfish'], missing: ['carpet_anemone'] },
    ];
    const h = pickGhost(possible, data.bonds, cb);
    expect(h?.missing).toBe('carpet_anemone');
    expect(ghostText(h!, data.species)).toBe('Add a Carpet Anemone to bond with Clownfish (+100%)');
  });

  it('ignores communities two fish short and empty input', () => {
    const possible: PossibleBond[] = [{ kind: 'community', bondId: 'reef_family', present: ['pebble_damsel'], missing: ['carpet_anemone', 'clownfish'] }];
    expect(pickGhost(possible, data.bonds, cb)).toBeNull();
    expect(pickGhost([], data.bonds, cb)).toBeNull();
  });

  it('community-only hint text uses "an" before a vowel', () => {
    const possible: PossibleBond[] = [{ kind: 'community', bondId: 'ice_floe', present: ['snow_crab', 'ice_krill'], missing: ['icefish'] }];
    const h = pickGhost(possible, data.bonds, cb);
    const name = data.species.find((s) => s.id === 'icefish')?.name ?? '';
    expect(ghostText(h!, data.species)).toBe(`Add ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name} to complete the Ice Floe (+${Math.round(cb * 100)}%)`);
  });
});
