// Bot-side economic estimator. Reuses the sim's own income model (computeCar /
// computeTrain) on hypothetical carriages so marginal estimates match the real rules.
// Read-only: never mutates sim state.
import type { Habitat, SpeciesDef } from '../data/schema';
import type { DataIndex } from '../sim/lookup';
import { computeCar, computeTrain, fareBaseMult, stationMult, fareAppeal, trainFromCars, type CarModel, type TrainModel } from '../sim/income';
import { cycleStations } from '../sim/rates';
import { legSeconds, ticketMult, upgradeFx, type UpgradeFx } from '../sim/upgrades';
import type { Carriage, Fish, PlacedDecor, SimState } from '../sim/types';

export const NEW_FISH_ID = '__bot_new';

export interface Econ {
  idx: DataIndex;
  state: SimState;
  fx: UpgradeFx;
  model: TrainModel;
  /** ticketMult × whale × oldFriend, as in computeTrain. */
  globalMult: number;
  /** Expected frenzy factor on fish output for this bot's feeding cadence. */
  frenzyF: number;
  /** Fare Shells/s per unit of fare weight (appeal × base fish Sps of a car), shuttle-cycle average. */
  fpa: number;
  /** Steady income: fish × frenzyF + fare rate. */
  income: number;
  /** Base income without frenzy (rewards, specials, requests use this). */
  baseIncome: number;
  /** Prototype-chained state view whose `fish` also resolves NEW_FISH_ID. */
  view: SimState;
  fishView: Record<string, Fish>;
}

function whaleMult(idx: DataIndex, state: SimState): number {
  const distinct = new Set<string>();
  let bonus = 0;
  const whales = new Set<string>();
  for (const car of state.carriages) {
    for (const id of car.fish) {
      const f = state.fish[id];
      if (!f) continue;
      distinct.add(f.species);
      const b = idx.species.get(f.species)?.flags.perDistinctSpeciesBonus;
      if (b && !whales.has(f.species)) { whales.add(f.species); bonus += b; }
    }
  }
  return 1 + bonus * distinct.size;
}

export function avgStationMult(idx: DataIndex, builtTo: number): number {
  const st = cycleStations(builtTo);
  let sum = 0;
  for (const k of st) sum += stationMult(idx, k);
  return sum / st.length;
}

export function arrivalSecs(idx: DataIndex, fx: UpgradeFx): number {
  return legSeconds(idx, fx) + idx.data.config.stopSeconds;
}

/** Per-car model cache (key = everything computeCar reads), so a re-plan after one
 *  purchase only recomputes the car that changed. */
export type CarCache = Map<string, { key: string; model: CarModel }>;

function carKey(state: SimState, car: Carriage, globalMult: number, upgrades: number): string {
  let k = `${globalMult}|${upgrades}|${car.habitat}|`;
  for (const id of car.fish) { const f = state.fish[id]; if (f) k += `${f.id}:${f.species}:${f.level}:${f.shiny ? 1 : 0}:${f.mascot ? 1 : 0},`; }
  k += '|';
  for (const d of car.decor) k += `${d.id},`;
  return k;
}

function cachedTrain(idx: DataIndex, state: SimState, fx: UpgradeFx, globalMult: number, cache: CarCache): TrainModel {
  const ups = state.permanent.upgrades.length;
  const cars = state.carriages.map((c) => {
    const key = carKey(state, c, globalMult, ups);
    const hit = cache.get(c.id);
    if (hit && hit.key === key) return hit.model;
    const model = computeCar(idx, state, c, fx, globalMult);
    cache.set(c.id, { key, model });
    return model;
  });
  return trainFromCars(idx, cars);
}

export function snapshot(idx: DataIndex, state: SimState, frenzyF: number, cache?: CarCache): Econ {
  const fx = upgradeFx(idx, state);
  const oldFriend = state.permanent.oldFriend ? 1 + idx.data.config.mascot.oldFriendBonus : 1;
  const globalMult = ticketMult(idx, state) * whaleMult(idx, state) * oldFriend;
  const model = cache ? cachedTrain(idx, state, fx, globalMult, cache) : computeTrain(idx, state, fx);
  const fpa = (fareBaseMult(idx, state, fx) * avgStationMult(idx, state.builtTo)) / arrivalSecs(idx, fx);
  const fareSps = model.fareWeight * fpa;
  // Object.create keeps lookups of real fish on the live record (prototype chain) while
  // letting us add a hypothetical fish without copying or mutating sim state.
  const fishView = Object.create(state.fish) as Record<string, Fish>;
  const view = Object.create(state) as SimState;
  view.fish = fishView;
  return {
    idx, state, fx, model, globalMult, frenzyF, fpa,
    income: model.baseFishSps * frenzyF + fareSps,
    baseIncome: model.baseFishSps + fareSps,
    view, fishView,
  };
}

/** Value of a car model in Shells/s (fish with expected frenzy + fare = appeal × base Sps). */
export function carValue(e: Econ, m: CarModel): number {
  return m.baseSps * (e.frenzyF + fareAppeal(e.idx, m.appeal) * e.fpa);
}

export interface CarChange {
  addSpecies?: string;
  removeFishId?: string;
  habitat?: Habitat;
  addDecor?: string;
}

/** Car model after a hypothetical change (fish added at level 1, removed, re-habitat, decor). */
export function evalCar(e: Econ, car: Carriage, ch: CarChange): CarModel {
  let fish = car.fish;
  if (ch.removeFishId) fish = fish.filter((id) => id !== ch.removeFishId);
  if (ch.addSpecies) {
    e.fishView[NEW_FISH_ID] = { id: NEW_FISH_ID, species: ch.addSpecies, level: 1, shiny: false, spent: 0, carId: car.id };
    fish = [...fish, NEW_FISH_ID];
  }
  let decor: PlacedDecor[] = car.decor;
  if (ch.addDecor) decor = [...decor, { id: ch.addDecor, x: 0.5, y: 0, layer: 'back', scale: 1, flip: false }];
  const hyp: Carriage = { ...car, fish, decor, habitat: ch.habitat ?? car.habitat };
  return computeCar(e.idx, e.view, hyp, e.fx, e.globalMult);
}

/** Current model of a car (from the snapshot). */
export function carModel(e: Econ, carId: string): CarModel | undefined {
  return e.model.byId.get(carId);
}

/** Bond-free value of one new level-1 fish of `sp` in a car of `habitat` (bond-never bot);
 *  with `car`, the fare cross-terms with that car's current appeal and output are included. */
export function rawFishValue(e: Econ, sp: SpeciesDef, habitat: Habitat, car?: CarModel): number {
  const cfg = e.idx.data.config;
  const hm = sp.flags.alwaysHome || sp.habitat === habitat ? 1 : cfg.offHabitatMult;
  const sps = sp.basePps * hm * e.globalMult;
  const appeal = sp.appeal * (sp.flags.appealCount ?? 1) * hm;
  const A = car?.appeal ?? 0;
  const S = car?.baseSps ?? 0;
  return sps * e.frenzyF + (fareAppeal(e.idx, A + appeal) * (S + sps) - fareAppeal(e.idx, A) * S) * e.fpa;
}

/** Δ fare Shells/s from extending the track by one station. */
export function trackFareGain(e: Econ): number {
  const s = e.state;
  if (s.builtTo >= e.idx.data.config.stationsPerLine) return 0;
  const base = fareBaseMult(e.idx, s, e.fx) / arrivalSecs(e.idx, e.fx);
  return e.model.fareWeight * base * (avgStationMult(e.idx, s.builtTo + 1) - avgStationMult(e.idx, s.builtTo));
}
