// Fish actions: buy, level, sell, move, feed (SPEC B4.4, B4.6 shiny, B4.7).
import type { SpeciesDef } from '../data/schema';
import { carIndex, fail, findCar, findFish, okCheck, type Check } from './actionCheck';
import { copyCost, levelCost } from './costs';
import type { Ctx } from './ctx';
import { rand } from './rng';
import { newId } from './state';
import { addStamp } from './train';
import type { Action, Fish } from './types';

type A<T extends Action['type']> = Extract<Action, { type: T }>;

/** Can this species be bought right now? First sale only at its home station market. */
export function speciesAvailable(ctx: Ctx, sp: SpeciesDef): boolean {
  const s = ctx.state;
  if (s.speciesBoughtThisRun.includes(sp.id)) return true;
  return sp.line === s.currentLine && sp.station === s.marketStation;
}

/** Create a fish in a car (purchase, rewards, mascot). Rolls shiny unless `shiny` is given. */
export function spawnFish(ctx: Ctx, species: string, carId: string, opts: { shiny?: boolean; level?: number; spent?: number } = {}): Fish {
  const s = ctx.state;
  const car = findCar(ctx, carId);
  if (!car) throw new Error(`sim: unknown car ${carId}`);
  const shiny = opts.shiny ?? rand(s) < ctx.idx.data.config.shinyChance;
  const f: Fish = { id: newId(s, 'f'), species, level: opts.level ?? 1, shiny, spent: opts.spent ?? 0, carId };
  s.fish[f.id] = f;
  car.fish.push(f.id);
  s.copiesOwned[species] = (s.copiesOwned[species] ?? 0) + 1;
  if (!s.speciesBoughtThisRun.includes(species)) s.speciesBoughtThisRun.push(species);
  addStamp(ctx, 'species', species);
  if (shiny) addStamp(ctx, 'shiny', species);
  return f;
}

export function checkBuyFish(ctx: Ctx, a: A<'buyFish'>): Check {
  const sp = ctx.idx.species.get(a.species);
  if (!sp) return fail('unknownSpecies');
  const car = findCar(ctx, a.carId);
  if (!car) return fail('unknownCar');
  if (car.fish.length >= car.slots) return fail('noSlot');
  if (!speciesAvailable(ctx, sp)) return fail('unavailable');
  const cost = copyCost(ctx.idx, ctx.state, sp, ctx.fx());
  return okCheck(cost, () => {
    const events = ctx.events.length;
    const f = spawnFish(ctx, sp.id, car.id, { spent: cost });
    ctx.state.lifetime.fishBought++;
    // Purchase event goes before the stamps spawnFish emitted.
    ctx.events.splice(events, 0, { type: 'purchase', item: 'fish', cost, refId: sp.id, carId: car.id, fishId: f.id, shiny: f.shiny });
    ctx.refreshBonds();
  });
}

export function checkLevelFish(ctx: Ctx, a: A<'levelFish'>): Check {
  const f = findFish(ctx, a.fishId);
  if (!f) return fail('unknownFish');
  const sp = ctx.idx.species.get(f.species);
  if (!sp) return fail('unknownSpecies');
  const max = ctx.idx.data.config.maxLevel;
  if (f.level >= max) return fail('maxLevel');
  let times: number;
  let cost = 0;
  if (a.times === 'max') {
    times = 0;
    const budget = ctx.state.shells;
    while (f.level + times < max) {
      const c = levelCost(ctx.idx, sp.baseCost, f.level + times);
      if (cost + c > budget) break;
      cost += c;
      times++;
    }
    if (times === 0) return okCheck(levelCost(ctx.idx, sp.baseCost, f.level), () => undefined);
  } else {
    if (!Number.isInteger(a.times) || a.times < 1) return fail('invalid');
    if (f.level + a.times > max) return fail('maxLevel');
    times = a.times;
    for (let i = 0; i < times; i++) cost += levelCost(ctx.idx, sp.baseCost, f.level + i);
  }
  return okCheck(cost, () => {
    const from = f.level;
    f.level += times;
    f.spent += cost;
    ctx.state.lifetime.levelsBought += times;
    ctx.emit({ type: 'levelUp', fishId: f.id, species: f.species, level: f.level, levels: times, cost });
    for (const m of ctx.idx.data.config.milestones.levels) {
      if (from < m && f.level >= m) ctx.emit({ type: 'milestone', fishId: f.id, species: f.species, level: m });
    }
    ctx.invalidate();
  });
}

export function checkSellFish(ctx: Ctx, a: A<'sellFish'>): Check {
  const f = findFish(ctx, a.fishId);
  if (!f) return fail('unknownFish');
  const refund = ctx.idx.data.config.sellRefund * f.spent;
  return okCheck(-refund, () => {
    const s = ctx.state;
    const car = findCar(ctx, f.carId);
    if (car) car.fish = car.fish.filter((id) => id !== f.id);
    delete s.fish[f.id];
    s.copiesOwned[f.species] = Math.max(0, (s.copiesOwned[f.species] ?? 1) - 1);
    s.shells += refund;
    ctx.emit({ type: 'sale', fishId: f.id, species: f.species, refund });
    ctx.refreshBonds();
  });
}

export function checkMoveFish(ctx: Ctx, a: A<'moveFish'>): Check {
  const f = findFish(ctx, a.fishId);
  if (!f) return fail('unknownFish');
  const to = findCar(ctx, a.carId);
  if (!to) return fail('unknownCar');
  if (to.id === f.carId) return fail('sameCar');
  if (to.fish.length >= to.slots) return fail('noSlot');
  return okCheck(0, () => {
    const from = findCar(ctx, f.carId);
    if (from) from.fish = from.fish.filter((id) => id !== f.id);
    to.fish.push(f.id);
    const fromCarId = f.carId;
    f.carId = to.id;
    ctx.emit({ type: 'fishMoved', fishId: f.id, fromCarId, toCarId: to.id });
    ctx.refreshBonds();
  });
}

export function checkFeed(ctx: Ctx, a: A<'feed'>): Check {
  const car = findCar(ctx, a.carId);
  if (!car || carIndex(ctx, a.carId) < 0) return fail('unknownCar');
  const s = ctx.state;
  const fr = s.frenzy[car.id];
  if (fr && s.time < fr.cooldownUntil) return fail('cooldown');
  return okCheck(0, () => {
    const cfg = ctx.idx.data.config.frenzy;
    const secs = ctx.model().byId.get(car.id)?.frenzySeconds ?? cfg.seconds;
    const next = { activeUntil: s.time + secs, cooldownUntil: s.time + cfg.cooldown };
    s.frenzy[car.id] = next;
    ctx.emit({ type: 'frenzy', carId: car.id, until: next.activeUntil, cooldownUntil: next.cooldownUntil });
  });
}
