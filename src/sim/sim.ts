// createSim: fixed-tick deterministic game-rules engine (SPEC C). No DOM / Three.
import type { GameData } from '../data/schema';
import { priceAction, runAction } from './actions';
import { earn } from './actionCheck';
import { createCtx, type Ctx } from './ctx';
import { buildIndex } from './lookup';
import { migrateSave } from './save';
import { blankState, startRun } from './state';
import { fareAt, fareModifierMult, tickTrain } from './train';
import { TICK, type Action, type ActionResult, type CarInfo, type SaveData, type SimEvent, type SimState, type SimStats } from './types';
import { legSeconds } from './upgrades';

export interface SimOptions {
  seed: number;
  save?: SaveData;
  /** Wall-clock ms at creation (offline catch-up is T-06; compare with save.savedAt). */
  now?: number;
}

export interface Sim {
  readonly state: SimState;
  advance(seconds: number): void;
  act(a: Action): ActionResult;
  price(a: Action): number | null;
  drainEvents(): SimEvent[];
  stats(): SimStats;
  carInfo(carId: string): CarInfo;
  /** `now` (wall-clock ms) is stored as savedAt; omitted → null (keeps output deterministic). */
  serialize(now?: number): SaveData;
}

/** Per-tick system hook (T-06: sights, requests …). Runs after income + train each tick. */
export type TickSystem = (ctx: Ctx, dt: number) => void;

export interface SimInternals { sim: Sim; ctx: Ctx; systems: TickSystem[] }

const EPS = 1e-9;

function fishModifierMult(ctx: Ctx): number {
  let m = 1;
  for (const mod of ctx.state.modifiers) if (mod.kind === 'fishIncomeMult') m *= mod.value;
  return m;
}

/** Current fish Shells/s of one car (frenzy + timed modifiers applied). */
function carSps(ctx: Ctx, carId: string, base: number): number {
  const fr = ctx.state.frenzy[carId];
  const frenzy = fr && ctx.state.time < fr.activeUntil - EPS ? ctx.idx.data.config.frenzy.mult : 1;
  return base * frenzy;
}

function currentFishSps(ctx: Ctx): number {
  let sps = 0;
  for (const c of ctx.model().cars) sps += carSps(ctx, c.carId, c.baseSps);
  return sps * fishModifierMult(ctx);
}

function tick(ctx: Ctx, systems: TickSystem[]): void {
  const s = ctx.state;
  const dt = TICK;
  const inc = currentFishSps(ctx) * dt;
  if (inc > 0) { earn(ctx, inc); s.lifetime.fishShells += inc; }
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

/** Stations visited in one full shuttle cycle over track 1..n (n ≥ 2). */
function cycleStations(n: number): number[] {
  const out: number[] = [];
  for (let k = 2; k <= n; k++) out.push(k);
  for (let k = n - 1; k >= 1; k--) out.push(k);
  return out;
}

function nextStation(s: SimState): number {
  const tr = s.train;
  if (tr.phase === 'moving') return tr.toStation;
  let dir = tr.dir;
  if (dir === 1 && tr.fromStation >= s.builtTo) dir = -1;
  else if (dir === -1 && tr.fromStation <= 1) dir = 1;
  return Math.min(Math.max(tr.fromStation + dir, 1), s.builtTo);
}

export function createSimInternal(data: GameData, opts: SimOptions): SimInternals {
  const idx = buildIndex(data);
  const fresh = !opts.save;
  const state = opts.save ? migrateSave(opts.save).state : blankState(opts.seed);
  const ctx = createCtx(idx, state);
  if (fresh) startRun(ctx, 1);
  const systems: TickSystem[] = [];

  const sim: Sim = {
    get state() { return ctx.state; },
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
    act: (a) => runAction(ctx, a),
    price: (a) => priceAction(ctx, a),
    drainEvents() {
      const e = ctx.events;
      ctx.events = [];
      return e;
    },
    stats() {
      const s = ctx.state;
      const fishSps = currentFishSps(ctx);
      const stations = cycleStations(s.builtTo);
      let sum = 0;
      for (const k of stations) sum += fareAt(ctx, k);
      const farePerArrival = (sum / stations.length) * fareModifierMult(ctx, false);
      const cycle = legSeconds(idx, ctx.fx()) + idx.data.config.stopSeconds;
      const fareSps = farePerArrival / cycle;
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
      const frenzyMult = carSps(ctx, carId, 1);
      return {
        carId,
        income: m.baseSps * frenzyMult * mod,
        appeal: m.appeal,
        activeBonds: m.bonds.active,
        possibleBonds: m.bonds.possible,
        fish: m.fish.map((f) => ({ ...f, sps: f.sps * frenzyMult * mod })),
        slotsUsed: car.fish.length,
        slots: car.slots,
        decorUsed: m.decorUsed,
        decorCapacity: m.decorCapacity,
        frenzyActive: frenzyMult > 1,
        frenzyReadyIn: fr ? Math.max(0, fr.cooldownUntil - s.time) : 0,
      };
    },
    serialize(now) {
      return { version: ctx.state.version, savedAt: now ?? null, state: JSON.parse(JSON.stringify(ctx.state)) as SimState };
    },
  };
  return { sim, ctx, systems };
}

export function createSim(data: GameData, opts: SimOptions): Sim {
  return createSimInternal(data, opts).sim;
}
