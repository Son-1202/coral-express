// One headless seeded game for the E1 balance harness: a bot plays for `minutes` of
// active sim time (or until the Grand Terminus) and we record the raw per-game facts
// the metrics need. Pure (no fs / workers) so tests and workers share it.
import { loadGameData, type GameData } from '../../src/data/schema';
import { createSim, type SimEvent, type StoryData } from '../../src/sim';
import requestsJson from '../../src/story/requests.json';
import { createBot, runBotSecond, type BotName } from '../../src/bots';

export type Variant = BotName | 'greedyOffline';
export const VARIANTS: readonly Variant[] = ['greedy', 'random', 'bondNever', 'greedyOffline'];

export interface GameSpec {
  variant: Variant;
  seed: number;
  minutes: number;
  /** greedyOffline: active minute at which one offline break happens. */
  offlineAt: number;
  offlineHours: number;
}

export interface ResetFact {
  /** Active seconds at the reset. */
  t: number;
  tickets: number;
  /** Largest single-species share of this run's fish income, and that species. */
  topShare: number;
  topSpecies: string;
}

export interface GameRecord {
  variant: Variant;
  seed: number;
  /** Active seconds played (≤ minutes × 60). */
  played: number;
  firstReset: number | null;
  terminus: number | null;
  resets: ResetFact[];
  firstPair: number | null;
  /** Average Shells/s over the 60 s before min 15 of run 1 (or before the first reset if earlier). */
  income15: number;
  earned: number;
  fare: number;
  fish: number;
  request: number;
  sight: number;
  offline: number;
  /** Per run: longest gap (s) between meaningful goals within minutes 5–15 of that run. */
  goalGaps: number[];
  /** Longest stretch (s) without any spending action after minute 1 (tail included). */
  deadTime: number;
  /** Species bought (any run) before the Terminus / end of the game. */
  species: string[];
  illegal: number;
  illegalSamples: string[];
}

let cached: { data: GameData; story: StoryData } | null = null;
function content(): { data: GameData; story: StoryData } {
  return (cached ??= { data: loadGameData(), story: requestsJson as StoryData });
}

const GOAL_WINDOW: [number, number] = [5 * 60, 15 * 60];
const INCOME_AT = 15 * 60;
const INCOME_WINDOW = 60;
const DEAD_AFTER = 60;

const SPEND: ReadonlySet<SimEvent['type']> = new Set(['purchase', 'levelUp', 'trackBuilt', 'specialBought', 'upgradeBought']);
const GOALS: ReadonlySet<SimEvent['type']> = new Set([
  'trackBuilt', 'bondFormed', 'milestone', 'requestCompleted', 'terminalReached', 'lineOpened', 'specialBought', 'upgradeBought', 'depotReset',
]);

/** Max gap between sorted goal times inside [lo, hi], counting the window edges. */
export function maxGap(times: number[], lo: number, hi: number): number {
  let prev = lo;
  let gap = 0;
  for (const t of times) {
    if (t < lo || t > hi) continue;
    gap = Math.max(gap, t - prev);
    prev = t;
  }
  return Math.max(gap, hi - prev);
}

export function runGame(spec: GameSpec): GameRecord {
  const { data, story } = content();
  const sim = createSim(data, { seed: spec.seed, story });
  const botName: BotName = spec.variant === 'greedyOffline' ? 'greedy' : spec.variant;
  const bot = createBot(botName, { data, story, seed: spec.seed });
  const end = spec.minutes * 60;
  const ring = new Float64Array(INCOME_WINDOW + 1);
  const rec: GameRecord = {
    variant: spec.variant, seed: spec.seed, played: 0, firstReset: null, terminus: null, resets: [], firstPair: null,
    income15: 0, earned: 0, fare: 0, fish: 0, request: 0, sight: 0, offline: 0, goalGaps: [], deadTime: 0, species: [],
    illegal: 0, illegalSamples: [],
  };
  const species = new Set<string>();
  let runStart = 0;
  let runSpecies = new Set<string>();
  let goals: number[] = [];
  let lastSpend = DEAD_AFTER;
  let resetReady = false;
  let income15Done = false;
  const ringAt = (t: number): number => ring[((t % ring.length) + ring.length) % ring.length]!;
  const income = (t: number): number => (sim.state.runShells - ringAt(t - INCOME_WINDOW)) / Math.min(INCOME_WINDOW, Math.max(1, t - runStart));
  const closeRun = (t: number): void => {
    const lo = runStart + GOAL_WINDOW[0];
    const hi = Math.min(runStart + GOAL_WINDOW[1], t);
    if (hi > lo) rec.goalGaps.push(maxGap(goals, lo, hi));
  };

  let t = 0;
  for (; t < end; t++) {
    if (spec.variant === 'greedyOffline' && t === spec.offlineAt * 60) sim.advanceOffline(spec.offlineHours * 3600);
    ring[t % ring.length] = sim.state.runShells;
    if (!income15Done && rec.resets.length === 0 && t === INCOME_AT) { rec.income15 = income(t); income15Done = true; }
    const step = runBotSecond(sim, bot, t, (a) => {
      if (a.type !== 'depotReset' || !sim.canDepotReset()) return;
      const sh = sim.state.speciesShells;
      let total = 0;
      let top = 0;
      let topSpecies = '';
      for (const [k, v] of Object.entries(sh)) { total += v; if (v > top) { top = v; topSpecies = k; } }
      if (!income15Done && rec.resets.length === 0) { rec.income15 = income(t); income15Done = true; }
      rec.resets.push({ t, tickets: sim.projectedTickets(), topShare: total > 0 ? top / total : 0, topSpecies });
    });
    step.results.forEach((r, i) => {
      if (r.ok) return;
      rec.illegal++;
      if (rec.illegalSamples.length < 5) rec.illegalSamples.push(`${t}:${JSON.stringify(step.actions[i])}:${r.reason}`);
    });
    let ending = false;
    for (const ev of sim.drainEvents()) {
      if (SPEND.has(ev.type)) {
        if (t >= DEAD_AFTER) rec.deadTime = Math.max(rec.deadTime, t - lastSpend);
        lastSpend = Math.max(lastSpend, t);
      }
      if (GOALS.has(ev.type)) goals.push(t);
      if (ev.type === 'purchase') {
        if (ev.item === 'carriage' || ev.item === 'slot') goals.push(t);
        if (ev.item === 'fish') {
          species.add(ev.refId);
          if (!runSpecies.has(ev.refId)) { runSpecies.add(ev.refId); goals.push(t); }
        }
      } else if (ev.type === 'bondFormed' && ev.kind === 'pair' && rec.firstPair === null) {
        rec.firstPair = t;
      } else if (ev.type === 'depotReset') {
        rec.firstReset ??= t;
        closeRun(t);
        runStart = t;
        runSpecies = new Set();
        goals = [];
        resetReady = false;
        ring.fill(0);
      } else if (ev.type === 'ending') {
        rec.terminus = t + 1;
        ending = true;
      }
    }
    if (!resetReady && sim.canDepotReset()) { resetReady = true; goals.push(t); }
    if (ending) { t++; break; }
  }
  if (!income15Done) rec.income15 = income(t);
  closeRun(t);
  if (rec.terminus === null) rec.deadTime = Math.max(rec.deadTime, t - lastSpend);
  const L = sim.state.lifetime;
  rec.played = t;
  rec.earned = L.shellsEarned;
  rec.fare = L.fareShells;
  rec.fish = L.fishShells;
  rec.request = L.requestShells;
  rec.sight = L.sightShells;
  rec.offline = L.offlineShells;
  rec.species = [...species];
  return rec;
}
