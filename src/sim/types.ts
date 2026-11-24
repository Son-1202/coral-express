// Public sim types: state, actions, events, save data. Plain JSON-safe objects only.
import type { Habitat, LineId } from '../data/schema';

export const SAVE_VERSION = 1;
/** Fixed simulation tick (seconds). */
export const TICK = 0.25;

// ---------------- state ----------------
export type TrainPhase = 'moving' | 'stopped';
export interface TrainState {
  /** Station the train left (moving) or is standing at (stopped). 1-based. */
  fromStation: number;
  /** Destination (moving); equals fromStation while stopped. */
  toStation: number;
  phase: TrainPhase;
  /** Seconds elapsed in the current phase. */
  t: number;
  /** +1 towards the terminal, -1 towards station 1. */
  dir: 1 | -1;
}

export type DecorLayer = 'back' | 'front';
export interface PlacedDecor {
  /** decor.json id, or plants.json id for plants that are not decor items. */
  id: string;
  /** Normalised tank coordinates 0..1. */
  x: number;
  y: number;
  layer: DecorLayer;
  /** 0.8..1.2 */
  scale: number;
  flip: boolean;
}

export interface CarCosmetics {
  sand: string;
  backdrop: string;
  paint: string;
}

export interface Carriage {
  id: string;
  habitat: Habitat;
  /** Total fish slots (base + extra). */
  slots: number;
  /** Extra slots bought for this carriage (drives slot cost + decor capacity). */
  extraSlots: number;
  /** Fish ids, in slot order. */
  fish: string[];
  decor: PlacedDecor[];
  cosmetics: CarCosmetics;
  heritage: boolean;
}

export interface Fish {
  id: string;
  species: string;
  level: number;
  shiny: boolean;
  /** Total Shells spent on this fish (purchase + levels); sell refunds a fraction. */
  spent: number;
  carId: string;
  nickname?: string;
  /** Mascot (T-06): ignores habitat penalty. */
  mascot?: boolean;
}

export interface FrenzyState {
  activeUntil: number;
  cooldownUntil: number;
}

/** Timed buff/debuff (Sights, T-06). `until` null = until the next arrival. */
export type ModifierKind = 'fishIncomeMult' | 'fareMult' | 'nextArrivalFareMult';
export interface Modifier {
  id: string;
  kind: ModifierKind;
  value: number;
  until: number | null;
}

export interface LifetimeStats {
  shellsEarned: number;
  fishShells: number;
  fareShells: number;
  arrivals: number;
  fishBought: number;
  levelsBought: number;
  playSeconds: number;
}

export interface PermanentState {
  tickets: number;
  totalTicketsEarned: number;
  upgrades: string[];
  openedLines: LineId[];
  /** Stamp ids: `station:<stationId>`, `species:<id>`, `shiny:<id>`. */
  stamps: string[];
  /** Station ids (`l<line>s<index>`) whose postcard is unlocked. */
  postcards: string[];
  /** Unlocked cosmetic ids (backdrop variants etc.). */
  unlockedCosmetics: string[];
  mascot: { species: string; shiny: boolean; nickname?: string } | null;
  /** Consecutive resets with the same mascot species. */
  oldFriendStreak: number;
  oldFriend: boolean;
  endless: boolean;
  reachedTerminals: LineId[];
  resets: number;
}

export interface SimState {
  version: number;
  /** Sim seconds since the save was created. */
  time: number;
  /** Seconds not yet consumed by a full tick. */
  tickAcc: number;
  ticks: number;
  rngState: number;
  nextId: number;
  shells: number;
  /** Shells earned this run (income + fares + rewards; not reduced by spending). */
  runShells: number;
  lifetime: LifetimeStats;
  currentLine: LineId;
  /** Track built up to this station (1-based) on the current line. */
  builtTo: number;
  /** Station of the last arrival this run (its market is open). */
  marketStation: number;
  /** Stations arrived at this run. */
  visitedThisRun: number[];
  terminalReachedThisRun: boolean;
  train: TrainState;
  carriages: Carriage[];
  fish: Record<string, Fish>;
  /** Currently owned copies per species (this run). */
  copiesOwned: Record<string, number>;
  speciesBoughtThisRun: string[];
  /** Owned decor copies this run (placed + in tray). */
  decorOwned: Record<string, number>;
  /** Copies bought this run (drives ×3 decor price growth). */
  decorBought: Record<string, number>;
  frenzy: Record<string, FrenzyState>;
  modifiers: Modifier[];
  permanent: PermanentState;
  /** Accumulator for the once-per-second "income" event. */
  incomeWindow: { seconds: number; amount: number };
}

export interface SaveData {
  version: number;
  /** Wall-clock ms at save time (for offline; null if unknown). */
  savedAt: number | null;
  state: SimState;
}

// ---------------- actions ----------------
export type CosmeticKind = 'sand' | 'backdrop' | 'paint';
export interface DecorPlacement {
  x: number;
  y: number;
  layer: DecorLayer;
  scale: number;
  flip: boolean;
}

export type Action =
  | { type: 'buyFish'; species: string; carId: string }
  | { type: 'levelFish'; fishId: string; times: number | 'max' }
  | { type: 'sellFish'; fishId: string }
  | { type: 'moveFish'; fishId: string; carId: string }
  | { type: 'buyCarriage'; habitat: Habitat }
  | { type: 'changeHabitat'; carId: string; habitat: Habitat }
  | { type: 'buySlot'; carId: string }
  | { type: 'buildTrack' }
  | { type: 'feed'; carId: string }
  | { type: 'buyDecor'; decorId: string }
  | ({ type: 'placeDecor'; carId: string; decorId: string } & DecorPlacement)
  | ({ type: 'moveDecor'; carId: string; index: number } & Partial<DecorPlacement>)
  | { type: 'removeDecor'; carId: string; index: number }
  | { type: 'setCosmetic'; carId: string; kind: CosmeticKind; value: string };
// T-06 adds: tapSight, buySpecial, acceptRequest, depotReset, buyUpgrade, chooseLine.

export type ActionType = Action['type'];

export type FailReason =
  | 'unknownSpecies' | 'unknownFish' | 'unknownCar' | 'unknownDecor' | 'unknownCosmetic'
  | 'unavailable' | 'cantAfford' | 'noSlot' | 'maxLevel' | 'maxCarriages' | 'maxSlots'
  | 'habitatLocked' | 'sameHabitat' | 'sameCar' | 'trackComplete' | 'cooldown'
  | 'noCopy' | 'noCapacity' | 'badIndex' | 'locked' | 'invalid';

export type ActionResult = { ok: true } | { ok: false; reason: FailReason };

// ---------------- events ----------------
export type PurchaseItem = 'fish' | 'carriage' | 'slot' | 'decor' | 'habitat';
export type BondKind = 'pair' | 'community';
export type StampKind = 'station' | 'species' | 'shiny';

export type SimEvent =
  | { type: 'purchase'; item: PurchaseItem; cost: number; refId: string; carId?: string; fishId?: string; shiny?: boolean }
  | { type: 'levelUp'; fishId: string; species: string; level: number; levels: number; cost: number }
  | { type: 'milestone'; fishId: string; species: string; level: number }
  | { type: 'sale'; fishId: string; species: string; refund: number }
  | { type: 'fishMoved'; fishId: string; fromCarId: string; toCarId: string }
  | { type: 'bondFormed'; carId: string; kind: BondKind; bondId: string; species: string[]; fishIds: string[] }
  | { type: 'bondBroken'; carId: string; kind: BondKind; bondId: string; species: string[]; fishIds: string[] }
  | { type: 'frenzy'; carId: string; until: number; cooldownUntil: number }
  | { type: 'frenzyEnd'; carId: string }
  | { type: 'depart'; from: number; to: number }
  | { type: 'arrive'; station: number; stationId: string; line: LineId }
  | { type: 'fare'; amount: number; station: number }
  | { type: 'trackBuilt'; station: number; cost: number }
  | { type: 'lineOpened'; line: LineId }
  | { type: 'terminalReached'; line: LineId; firstTime: boolean }
  | { type: 'stamp'; stampId: string; kind: StampKind; ref: string }
  /** suppressToast: true for the final terminal postcard (D-011: the ending shows it). */
  | { type: 'postcard'; stationId: string; suppressToast: boolean }
  | { type: 'ending'; line: LineId }
  | { type: 'income'; amount: number; seconds: number }
  | { type: 'decorChanged'; carId: string }
  | { type: 'cosmeticChanged'; carId: string; kind: CosmeticKind; value: string };

export type SimEventType = SimEvent['type'];

// ---------------- read models ----------------
export interface BondInfo {
  kind: BondKind;
  bondId: string;
  species: string[];
  fishIds: string[];
  /** Output bonus (fraction, e.g. 0.5 = +50%) incl. decor/upgrade pp. */
  bonus: number;
}
export interface PossibleBond {
  kind: BondKind;
  bondId: string;
  present: string[];
  /** Species ids still missing in this car. */
  missing: string[];
}
export interface FishIncomeInfo {
  fishId: string;
  species: string;
  sps: number;
  habitatMult: number;
  bondMult: number;
  appeal: number;
}
export interface CarInfo {
  carId: string;
  /** Current Shells/s of the car's fish (incl. frenzy + modifiers). */
  income: number;
  appeal: number;
  activeBonds: BondInfo[];
  possibleBonds: PossibleBond[];
  fish: FishIncomeInfo[];
  slotsUsed: number;
  slots: number;
  decorUsed: number;
  decorCapacity: number;
  frenzyActive: boolean;
  frenzyReadyIn: number;
}

export interface SimStats {
  fishSps: number;
  /** Average fare per arrival over one full shuttle cycle of the built track. */
  farePerArrival: number;
  fareSps: number;
  totalSps: number;
  /** Fare the next arrival would pay right now (incl. next-arrival modifiers). */
  nextFare: number;
}
