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
  /** T-06 income sources (shells credited via earn()). */
  sightShells: number;
  requestShells: number;
  offlineShells: number;
  offlineSeconds: number;
  /** Shells lost to the Seagull Thief. */
  sightLosses: number;
  requestsCompleted: number;
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
  /** T-20: runs in which each Line's terminal was reached (key = line id). */
  terminalRuns: Record<string, number>;
  resets: number;
  /** Request ids ever completed (unique, first-completion order; kept across resets). */
  requestHistory: string[];
  /** Completions per request id (kept across resets). */
  requestCounts: Record<string, number>;
}

// ---------------- T-06 meta state ----------------
export interface ActiveSight {
  id: string;
  startedAt: number;
  /** Sim time the sight ends; null = until its next-arrival modifier is consumed. */
  until: number | null;
  requiresTap: boolean;
}
export interface SightState {
  active: ActiveSight | null;
  /** Sim time of the next sight start; < 0 = not scheduled yet. */
  nextAt: number;
}

export type SpecialKind = 'levelDiscount' | 'shinyEgg' | 'freeSlot' | 'cosmetic';
export interface TodaysSpecial {
  kind: SpecialKind;
  /** Shells, fixed when the market opens. */
  price: number;
  /** levelDiscount: the discounted species. */
  species?: string;
  /** cosmetic: the backdrop id unlocked. */
  cosmetic?: string;
  sold: boolean;
}
export interface MarketState {
  station: number;
  /** '' = not built yet (rebuilt on load). */
  stationId: string;
  /** Fish stall: signature species first, then up to 2 from earlier stations. */
  fish: string[];
  /** Decor & plants stall (3 seeded ids). */
  decor: string[];
  special: TodaysSpecial | null;
  /** Request ids on this station's board. */
  requests: string[];
}
export interface RequestBoard {
  ids: string[];
  /** Arrivals since the board was (re)built, incl. that one. */
  visits: number;
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
  sight: SightState;
  market: MarketState;
  /** Per station id, this run. */
  requestBoards: Record<string, RequestBoard>;
  /** Species → remaining discounted level-ups (Today's Special). */
  levelDiscounts: Record<string, number>;
  /** Shiny Eggs: `any` = next fish purchase of any species; `species` = per species. */
  shinyEggs: { any: number; species: string[] };
  /** Request ids completed this run (cleared by Depot Reset; each completes once per run). */
  requestsDoneThisRun: string[];
  /** Fish Shells earned per species this run (E1 dominance metric). */
  speciesShells: Record<string, number>;
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
  | { type: 'setCosmetic'; carId: string; kind: CosmeticKind; value: string }
  | { type: 'tapSight' }
  /** target: species id (shinyEgg) or car id (freeSlot); ignored otherwise. */
  | { type: 'buySpecial'; target?: string }
  | { type: 'buyUpgrade'; id: string }
  /** The only way to choose a line (B4.9). mascotName defaults to nickname / species name. */
  | { type: 'depotReset'; mascotFishId: string; mascotName?: string; nextLine: LineId };

export type ActionType = Action['type'];

export type FailReason =
  | 'unknownSpecies' | 'unknownFish' | 'unknownCar' | 'unknownDecor' | 'unknownCosmetic'
  | 'unavailable' | 'cantAfford' | 'noSlot' | 'maxLevel' | 'maxCarriages' | 'maxSlots'
  | 'habitatLocked' | 'sameHabitat' | 'sameCar' | 'trackComplete' | 'cooldown'
  | 'noCopy' | 'noCapacity' | 'badIndex' | 'locked' | 'invalid'
  | 'noSight' | 'soldOut' | 'owned' | 'notReady' | 'noCandidate';

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
  | { type: 'cosmeticChanged'; carId: string; kind: CosmeticKind; value: string }
  | { type: 'sightStart'; sightId: string; until: number | null; requiresTap: boolean }
  /** shells: gained (+) or lost (−) when it ended; fishId for a Stowaway. */
  | { type: 'sightEnd'; sightId: string; tapped: boolean; shells: number; fishId?: string }
  | { type: 'market'; station: number; stationId: string }
  | { type: 'specialBought'; kind: SpecialKind; cost: number; target?: string }
  | { type: 'requestCompleted'; requestId: string; stationId: string; passenger: string; carId: string; shells: number; rewardType: string; rewardRef?: string }
  | { type: 'upgradeBought'; id: string; tickets: number }
  | { type: 'depotReset'; tickets: number; totalTicketsEarned: number; line: LineId; mascotSpecies: string; oldFriend: boolean }
  | { type: 'offline'; seconds: number; shells: number; stationsVisited: number };

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

export interface OfflineResult {
  /** Seconds credited (after the cap). */
  seconds: number;
  shells: number;
  stationsVisited: number;
}
