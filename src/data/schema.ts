// Typed schema for every JSON file in src/data/. No runtime deps.
import configJson from './config.json';
import speciesJson from './species.json';
import bondsJson from './bonds.json';
import decorJson from './decor.json';
import plantsJson from './plants.json';
import upgradesJson from './upgrades.json';
import linesJson from './lines.json';
import sightsJson from './sights.json';
import cosmeticsJson from './cosmetics.json';

export type Habitat = 'reef' | 'mangrove' | 'kelp' | 'polar' | 'vent';
export type SpeciesHabitat = Habitat | 'any';
export type LineId = 1 | 2 | 3;
export type DecorPool = 'l1' | 'l2' | 'l3' | 'reward';
export type MotionProfile =
  | 'darter' | 'hoverer' | 'glider' | 'sinuous' | 'crawler'
  | 'hopper' | 'pulser' | 'swarm' | 'sessile';

export const HABITATS: readonly Habitat[] = ['reef', 'mangrove', 'kelp', 'polar', 'vent'];

// ---------- config.json ----------
export interface Config {
  startShells: number;
  startTrackStation: number;
  stationsPerLine: number;
  legSeconds: number;
  stopSeconds: number;
  startCarriages: number;
  maxCarriages: number;
  carriageBase: number;
  carriageGrowth: number;
  startSlots: number;
  maxSlots: number;
  slotCostFactor: number;
  slotGrowth: number;
  decorCapacityBase: number;
  decorCapacityPerSlot: number;
  habitatChangeFactor: number;
  copyCostGrowth: number;
  levelCostGrowth: number;
  maxLevel: number;
  milestones: { levels: number[]; mult: number };
  offHabitatMult: number;
  fareAppealFactor: number;
  stationMults: number[];
  frenzy: { mult: number; seconds: number; cooldown: number };
  shinyChance: number;
  shinyAppealMult: number;
  sightInterval: [number, number];
  depotReset: { minRunShells: number; divisor: number };
  ticketIncomePerTicket: number;
  offline: { rate: number; capHours: number };
  sellRefund: number;
  decorCopyGrowth: number;
  communityBonus: number;
  communityAppeal: number;
  mascot: { startLevel: number; oldFriendStreak: number; oldFriendBonus: number };
  request: { refreshVisits: number };
  endless: { fareMult: number };
  todaysSpecial: { priceSecondsOfIncome: number; levelDiscount: number; levelDiscountCount: number };
}

// ---------- species.json ----------
export interface SpeciesFlags {
  firstFree?: boolean;
  sessile?: boolean;
  /** Counts as N fish for appeal (krill = 2). */
  appealCount?: number;
  /** Always treated as home habitat (whale). */
  alwaysHome?: boolean;
  /** +X to all fish output per distinct species on the train (whale 0.05). */
  perDistinctSpeciesBonus?: number;
  hopsOnGlass?: boolean;
  snapOnFeed?: boolean;
}
export interface SpeciesDef {
  id: string;
  name: string;
  habitat: SpeciesHabitat;
  line: LineId;
  station: number;
  baseCost: number;
  basePps: number;
  appeal: number;
  motion: MotionProfile;
  motionVariant?: 'sinuousTail';
  flags: SpeciesFlags;
}

// ---------- bonds.json ----------
export interface PairBond { a: string; b: string; bonus: number }
export interface Community { id: string; name: string; members: [string, string, string] }
export interface BondsData { pairs: PairBond[]; communities: Community[] }

// ---------- decor.json / plants.json ----------
export interface Sway { freq: number; amp: number }
export type DecorEffect =
  | { type: 'carIncome'; value: number }
  | { type: 'habitatIncome'; habitat: Habitat; value: number }
  | { type: 'frenzySeconds'; value: number }
  | { type: 'bondBonusPP'; value: number }
  | { type: 'hide' };
export interface DecorDef {
  id: string;
  name: string;
  pool: DecorPool;
  /** null = not purchasable (request reward). */
  baseCost: number | null;
  capacity: number;
  appeal: number;
  isPlant: boolean;
  /** Plant sprite id in plants.json (plants only). */
  plantId?: string;
  sway?: Sway;
  memento?: boolean;
  effects: DecorEffect[];
}
export interface PlantDef {
  id: string; // `<habitat>_<n>`
  name: string;
  habitat: Habitat;
  pool: Exclude<DecorPool, 'reward'>;
  baseCost: number;
  capacity: number;
  appeal: number;
  /** If set, this sprite IS that decor item; decor.json values are authoritative. */
  decorId?: string;
  sway: Sway;
}

// ---------- upgrades.json ----------
export type UpgradeEffect =
  | { type: 'offline'; capHours: number; rate: number }
  | { type: 'startShellsPerTicket'; value: number }
  | { type: 'legSeconds'; value: number }
  | { type: 'speciesCostMult'; value: number }
  | { type: 'startSlots'; value: number }
  | { type: 'sightFrequencyMult'; value: number }
  | { type: 'fareMult'; value: number }
  | { type: 'pairBonusPP'; value: number }
  | { type: 'communityBonusPP'; value: number };
export interface UpgradeDef { id: string; name: string; cost: number; effects: UpgradeEffect[] }

// ---------- lines.json ----------
export interface LinePalette { sky: string; sea: string; land: string; accent: string; mood: string }
export interface LineDef {
  id: LineId;
  name: string;
  region: string;
  habitats: Habitat[];
  fareMult: number;
  trackBase: number;
  trackGrowth: number;
  /** Line whose terminal must be reached once; null = open at start. */
  opensAfter: LineId | null;
  decorPool: Exclude<DecorPool, 'reward'>;
  palette: LinePalette;
}

// ---------- sights.json ----------
export type SightEffect =
  | { type: 'fishIncomeMult'; value: number }
  | { type: 'fareMult'; value: number }
  | { type: 'nextArrivalFareMult'; value: number };
export type SightTapReward =
  | { type: 'none' }
  | { type: 'fishIncomeSeconds'; seconds: number }
  | { type: 'freeFish'; source: 'ownedHabitatSpecies'; needsFreeSlot: boolean };
export interface SightMissPenalty { type: 'loseShellsFraction'; value: number }
export interface SightDef {
  id: string;
  name: string;
  /** null = lasts until the next arrival. */
  durationSeconds: number | null;
  requiresTap: boolean;
  effects: SightEffect[];
  tapReward: SightTapReward | null;
  missPenalty: SightMissPenalty | null;
}

// ---------- cosmetics.json ----------
export interface ColorSwatch { id: string; name: string; hex: string }
export interface BackdropDef {
  id: string; // `backdrop_<habitat>_<v>`, v=0 default
  name: string;
  habitat: Habitat;
  tint: string;
  isDefault: boolean;
  unlockable: boolean;
}
export interface CosmeticsData { sand: ColorSwatch[]; paints: ColorSwatch[]; backdrops: BackdropDef[] }

// ---------- aggregate ----------
export interface GameData {
  config: Config;
  species: SpeciesDef[];
  bonds: BondsData;
  decor: DecorDef[];
  plants: PlantDef[];
  upgrades: UpgradeDef[];
  lines: LineDef[];
  sights: SightDef[];
  cosmetics: CosmeticsData;
}

/** Static import of all data files. JSON literal types widen (e.g. string vs union), hence the casts. */
export function loadGameData(): GameData {
  return {
    config: configJson as Config,
    species: speciesJson as SpeciesDef[],
    bonds: bondsJson as BondsData,
    decor: decorJson as DecorDef[],
    plants: plantsJson as PlantDef[],
    upgrades: upgradesJson as UpgradeDef[],
    lines: linesJson as LineDef[],
    sights: sightsJson as SightDef[],
    cosmetics: cosmeticsJson as CosmeticsData,
  };
}
