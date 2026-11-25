// createSim: fixed-tick deterministic game-rules engine (SPEC C). No DOM / Three.
import type { GameData } from '../data/schema';
import { priceAction, runAction } from './actions';
import { createCtx, type Ctx } from './ctx';
import { canDepotReset, depotPreview, placeMascot, projectedTickets } from './depot';
import { buildIndex } from './lookup';
import { openMarket } from './market';
import { advanceOffline } from './offline';
import {
  arrivalSeconds, creditFishIncome, cycleStations, fareAt, fareModifierMult, fishModifierMult, frenzyMult, nextStation,
} from './rates';
import { migrateSave } from './save';
import { sightSystem, startSight } from './sights';
import { blankState, startRun } from './state';
import type { StoryData } from './story';
import { tickTrain } from './train';
import {
  TICK, type Action, type ActionResult, type CarInfo, type DepotPreview, type OfflineResult, type SaveData, type SimEvent, type SimState, type SimStats,
} from './types';

export interface SimOptions {
  seed: number;
  /** A SaveData, its JSON string, or anything else (invalid → fresh game). */
  save?: unknown;
  /** Wall-clock ms at creation. With a save that has savedAt, offline time is applied once. */
  now?: number;
  /** Story content (src/story/requests.json). Omitted → no Passenger Requests. */
  story?: StoryData;
}

export interface Sim {
  readonly state: SimState;
  advance(seconds: number): void;
  /** Offline catch-up (capped); emits an `offline` event. */
  advanceOffline(seconds: number): OfflineResult;
  act(a: Action): ActionResult;
  price(a: Action): number | null;
  drainEvents(): SimEvent[];
  stats(): SimStats;
  carInfo(carId: string): CarInfo;
  canDepotReset(): boolean;
  projectedTickets(): number;
  /** T-33: reset checklist, grant, income multipliers and next-Ticket threshold. */
  depotPreview(): DepotPreview;
  /** Debug: start a Sight now (false if unknown id or one is active). */
  triggerSight(id: string): boolean;
  /** Offline result applied while loading (opts.now − save.savedAt), else null. */
  readonly offlineReport: OfflineResult | null;
  /** `now` (wall-clock ms) is stored as savedAt; omitted → null (keeps output deterministic). */
  serialize(now?: number): SaveData;
}

/** Per-tick system hook (sights are built in). Runs after income + train each tick. */
export type TickSystem = (ctx: Ctx, dt: number) => void;

export interface SimInternals { sim: Sim; ctx: Ctx; systems: TickSystem[] }

const EPS = 1e-9;

function tick(ctx: Ctx, systems: TickSystem[]): void {
  const s = ctx.state;
  const dt = TICK;
  const inc = creditFishIncome(ctx, dt);
  s.incomeWindow.seconds += dt;
  s.incomeWindow.amount += inc;
  if (s.incomeWindow.seconds >= 1 - EPS) {
    ctx.emit({ type: 'income', amount: s.incomeWindow.amount, seconds: s.incomeWindow.seconds });
    s.incomeWindow = { seconds: 0, amount: 0 };
  }
  tickTrain(ctx, dt);
  for (const sys of systems) sys(ctx, dt);
  const prev = s.time;
  s.time = prev + dt;
  s.ticks++;
  s.lifetime.playSeconds += dt;
  for (const [carId, fr] of Object.entries(s.frenzy)) {
    if (fr.activeUntil > prev + EPS && fr.activeUntil <= s.time + EPS) ctx.emit({ type: 'frenzyEnd', carId });
  }
  if (s.modifiers.length) s.modifiers = s.modifiers.filter((m) => m.until === null || m.until > s.time + EPS);
}

/** Drop references the data no longer knows (renamed species etc.) so a save never crashes. */
function sanitize(ctx: Ctx): void {
  const s = ctx.state;
  for (const [id, f] of Object.entries(s.fish)) {
    if (!ctx.idx.species.has(f.species) || !s.carriages.some((c) => c.id === f.carId)) delete s.fish[id];
  }
  for (const c of s.carriages) {
    c.fish = c.fish.filter((id) => s.fish[id]?.carId === c.id);
    c.decor = c.decor.filter((d) => ctx.idx.decor.has(d.id));
  }
  if (!ctx.idx.lines.has(s.currentLine)) s.currentLine = 1;
}

export function createSimInternal(data: GameData, opts: SimOptions): SimInternals {
  const idx = buildIndex(data, opts.story);
  const save = opts.save === undefined ? null : migrateSave(opts.save, opts.seed);
  const state = save ? save.state : blankState(opts.seed);
  const ctx = createCtx(idx, state);
  if (state.carriages.length === 0) {
    startRun(ctx, 1);
    placeMascot(ctx);
  } else {
    sanitize(ctx);
    ctx.invalidate();
    if (state.market.stationId === '') openMarket(ctx, state.marketStation);
  }
  const systems: TickSystem[] = [sightSystem];
  let offlineReport: OfflineResult | null = null;

  const sim: Sim = {
    get state() { return ctx.state; },
    get offlineReport() { return offlineReport; },
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      const s = ctx.state;
      s.tickAcc += seconds;
      while (s.tickAcc >= TICK - EPS) {
        tick(ctx, systems);
        s.tickAcc -= TICK;
      }
      if (s.tickAcc < 0) s.tickAcc = 0;
    },
    advanceOffline: (seconds) => advanceOffline(ctx, seconds),
    act: (a) => runAction(ctx, a),
    price: (a) => priceAction(ctx, a),
    drainEvents() {
      const e = ctx.events;
      ctx.events = [];
      return e;
    },
    stats() {
      const s = ctx.state;
      const fishSps = ctx.model().cars.reduce((sum, c) => sum + c.baseSps * frenzyMult(ctx, c.carId), 0) * fishModifierMult(ctx);
      const stations = cycleStations(s.builtTo);
      let sum = 0;
      for (const k of stations) sum += fareAt(ctx, k);
      const farePerArrival = (sum / stations.length) * fareModifierMult(ctx, false);
      const fareSps = farePerArrival / arrivalSeconds(ctx);
      const nextFare = fareAt(ctx, nextStation(s)) * fareModifierMult(ctx, true);
      return { fishSps, farePerArrival, fareSps, totalSps: fishSps + fareSps, nextFare };
    },
    carInfo(carId) {
      const s = ctx.state;
      const car = s.carriages.find((c) => c.id === carId);
      const m = ctx.model().byId.get(carId);
      if (!car || !m) throw new Error(`sim: unknown car ${carId}`);
      const fr = s.frenzy[carId];
      const mod = fishModifierMult(ctx);
      const fm = frenzyMult(ctx, carId);
      return {
        carId,
        income: m.baseSps * fm * mod,
        appeal: m.appeal,
        activeBonds: m.bonds.active,
        possibleBonds: m.bonds.possible,
        fish: m.fish.map((f) => ({ ...f, sps: f.sps * fm * mod })),
        slotsUsed: car.fish.length,
        slots: car.slots,
        decorUsed: m.decorUsed,
        decorCapacity: m.decorCapacity,
        frenzyActive: fm > 1,
        frenzyReadyIn: fr ? Math.max(0, fr.cooldownUntil - s.time) : 0,
      };
    },
    canDepotReset: () => canDepotReset(ctx),
    projectedTickets: () => projectedTickets(ctx),
    depotPreview: () => depotPreview(ctx),
    triggerSight: (id) => startSight(ctx, id),
    serialize(now) {
      return { version: ctx.state.version, savedAt: now ?? null, state: JSON.parse(JSON.stringify(ctx.state)) as SimState };
    },
  };
  if (save && save.savedAt !== null && opts.now !== undefined && opts.now > save.savedAt) {
    offlineReport = advanceOffline(ctx, (opts.now - save.savedAt) / 1000);
  }
  return { sim, ctx, systems };
}

export function createSim(data: GameData, opts: SimOptions): Sim {
  return createSimInternal(data, opts).sim;
}
