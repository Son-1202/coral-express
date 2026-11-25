// Frozen rules fixture for sim unit tests (T-20). The live data files are tuned for E1
// balance and keep moving; formula tests pin these SPEC-era numbers instead so they test
// the rules, not the current tuning. New T-20 rule fields are left at their neutral
// defaults (no per-Line ticket divisor, Lines open after one terminal run, linear fare
// appeal) unless a test sets them.
import { loadGameData, type GameData } from '../../../src/data/schema';

const SPECIES: Record<string, [number, number]> = {
  pebble_damsel: [10, 0.5], carpet_anemone: [80, 2], clownfish: [500, 9], mudskipper: [3500, 45],
  pistol_shrimp: [25000, 240], watchman_goby: [180000, 1300], garibaldi: [4e6, 25000],
  kelp_seahorse: [2.5e7, 130000], leafy_seadragon: [1.6e8, 700000], ice_krill: [1e9, 3.6e6],
  icefish: [6.5e9, 2e7], snow_crab: [4e10, 1.1e8], tubeworm: [1.5e12, 3.5e9], yeti_crab: [1e13, 2e10],
  scaly_snail: [6.5e13, 1.1e11], vent_octopus: [4e14, 6e11], ghost_ray: [2.5e15, 3.2e12], pocket_whale: [1.6e16, 1.6e13],
};
const TRACK: Record<number, number> = { 1: 120, 2: 3e6, 3: 7.5e10 };

export function fixtureData(): GameData {
  const d = structuredClone(loadGameData());
  for (const s of d.species) {
    const v = SPECIES[s.id];
    if (v) { s.baseCost = v[0]; s.basePps = v[1]; }
  }
  for (const l of d.lines) {
    l.trackBase = TRACK[l.id] ?? l.trackBase;
    l.trackGrowth = 8;
    delete l.ticketDivisor;
    delete l.opensAfterRuns;
  }
  for (const p of d.bonds.pairs) p.bonus = p.a === 'garibaldi' || p.a === 'vent_octopus' ? 0.4 : 0.5;
  const c = d.config;
  c.levelCostGrowth = 1.15;
  c.fareAppealFactor = 8;
  delete c.fareAppealHalf;
  c.stationMults = [1, 1.4, 2, 2.8, 4, 6];
  c.communityBonus = 1;
  c.depotReset = { minRunShells: 1e6, divisor: 1e5 };
  return d;
}
