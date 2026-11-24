// Income model (SPEC B4.5). Computes a cached per-car model of base output and appeal;
// frenzy and timed modifiers are applied per tick on top of `baseSps`.
import type { DecorEffect, Habitat, SpeciesDef } from '../data/schema';
import { resolveBonds, type CarBonds } from './bonds';
import { milestoneMult } from './costs';
import { lineDef, type DataIndex } from './lookup';
import type { Carriage, Fish, FishIncomeInfo, SimState } from './types';
import { ticketMult, type UpgradeFx } from './upgrades';

export interface CarModel {
  carId: string;
  /** Shells/s of all fish in the car, before frenzy and timed modifiers. */
  baseSps: number;
  appeal: number;
  bonds: CarBonds;
  fish: FishIncomeInfo[];
  decorUsed: number;
  decorCapacity: number;
  frenzySeconds: number;
}

export interface TrainModel {
  cars: CarModel[];
  byId: Map<string, CarModel>;
  totalAppeal: number;
  baseFishSps: number;
}

function speciesOf(idx: DataIndex, f: Fish): SpeciesDef {
  const sp = idx.species.get(f.species);
  if (!sp) throw new Error(`sim: unknown species ${f.species}`);
  return sp;
}

export function habitatMult(idx: DataIndex, sp: SpeciesDef, f: Fish, carHabitat: Habitat): number {
  if (sp.flags.alwaysHome || f.mascot || sp.habitat === carHabitat) return 1;
  return idx.data.config.offHabitatMult;
}

export function decorCapacity(idx: DataIndex, car: Carriage): number {
  const c = idx.data.config;
  return c.decorCapacityBase + c.decorCapacityPerSlot * car.extraSlots;
}

export function decorUsed(idx: DataIndex, car: Carriage): number {
  let used = 0;
  for (const d of car.decor) used += idx.decor.get(d.id)?.capacity ?? 0;
  return used;
}

/** Effects of distinct decor ids in a car (same-id effects don't stack). */
function uniqueDecorEffects(idx: DataIndex, car: Carriage): DecorEffect[] {
  const seen = new Set<string>();
  const out: DecorEffect[] = [];
  for (const d of car.decor) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(...(idx.decor.get(d.id)?.effects ?? []));
  }
  return out;
}

/** Whale: +bonus per distinct species on the train (one whale species counts once). */
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

export function computeCar(idx: DataIndex, state: SimState, car: Carriage, fx: UpgradeFx, globalMult: number): CarModel {
  const cfg = idx.data.config;
  const fish = car.fish.map((id) => state.fish[id]).filter((f): f is Fish => !!f);
  const effects = uniqueDecorEffects(idx, car);
  let carIncome = 0;
  let bondPP = 0;
  let frenzySeconds = cfg.frenzy.seconds;
  const habitatIncome: Partial<Record<Habitat, number>> = {};
  for (const e of effects) {
    if (e.type === 'carIncome') carIncome += e.value;
    else if (e.type === 'habitatIncome') habitatIncome[e.habitat] = (habitatIncome[e.habitat] ?? 0) + e.value;
    else if (e.type === 'bondBonusPP') bondPP += e.value;
    else if (e.type === 'frenzySeconds') frenzySeconds = Math.max(frenzySeconds, e.value);
  }
  const bonds = resolveBonds(idx, fish, bondPP, fx);
  let baseSps = 0;
  let appeal = bonds.communityAppeal;
  for (const d of car.decor) appeal += idx.decor.get(d.id)?.appeal ?? 0;
  const infos: FishIncomeInfo[] = [];
  for (const f of fish) {
    const sp = speciesOf(idx, f);
    const hm = habitatMult(idx, sp, f, car.habitat);
    const bm = 1 + (bonds.fishBonus.get(f.id) ?? 0);
    const dm = 1 + carIncome + (sp.habitat === 'any' ? 0 : habitatIncome[sp.habitat] ?? 0);
    const sps = sp.basePps * f.level * milestoneMult(idx, f.level) * hm * bm * dm * globalMult;
    const fa = sp.appeal * (sp.flags.appealCount ?? 1) * hm * (f.shiny ? cfg.shinyAppealMult : 1);
    baseSps += sps;
    appeal += fa;
    infos.push({ fishId: f.id, species: f.species, sps, habitatMult: hm, bondMult: bm, appeal: fa });
  }
  return {
    carId: car.id, baseSps, appeal, bonds, fish: infos,
    decorUsed: decorUsed(idx, car), decorCapacity: decorCapacity(idx, car), frenzySeconds,
  };
}

export function computeTrain(idx: DataIndex, state: SimState, fx: UpgradeFx): TrainModel {
  const oldFriend = state.permanent.oldFriend ? 1 + idx.data.config.mascot.oldFriendBonus : 1;
  const globalMult = ticketMult(idx, state) * whaleMult(idx, state) * oldFriend;
  const cars = state.carriages.map((c) => computeCar(idx, state, c, fx, globalMult));
  let totalAppeal = 0;
  let baseFishSps = 0;
  for (const c of cars) { totalAppeal += c.appeal; baseFishSps += c.baseSps; }
  return { cars, byId: new Map(cars.map((c) => [c.carId, c] as const)), totalAppeal, baseFishSps };
}

/** Fare multiplier independent of station and appeal (line, tickets, upgrades, endless). */
export function fareBaseMult(idx: DataIndex, state: SimState, fx: UpgradeFx): number {
  const cfg = idx.data.config;
  const endless = state.permanent.endless ? cfg.endless.fareMult : 1;
  return cfg.fareAppealFactor * lineDef(idx, state.currentLine).fareMult * ticketMult(idx, state) * fx.fareMult * endless;
}

export function stationMult(idx: DataIndex, station: number): number {
  const m = idx.data.config.stationMults;
  return m[station - 1] ?? m[m.length - 1] ?? 1;
}
