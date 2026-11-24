// Carriage, track, decor and cosmetic actions (SPEC B4.2, B4.3, B5.3).
import { HABITATS } from '../data/schema';
import { carIndex, fail, findCar, okCheck, type Check } from './actionCheck';
import { carriagePrice, decorCost, habitatChangeCost, slotCost, trackCost } from './costs';
import type { Ctx } from './ctx';
import { decorCapacity, decorUsed } from './income';
import { habitatsForLine, poolLine } from './lookup';
import { defaultBackdrop, newCarriage } from './state';
import type { Action, DecorLayer, DecorPlacement } from './types';

type A<T extends Action['type']> = Extract<Action, { type: T }>;

export function checkBuyCarriage(ctx: Ctx, a: A<'buyCarriage'>): Check {
  const s = ctx.state;
  if (s.carriages.length >= ctx.idx.data.config.maxCarriages) return fail('maxCarriages');
  if (!HABITATS.includes(a.habitat)) return fail('invalid');
  if (!habitatsForLine(ctx.idx, s.currentLine).includes(a.habitat)) return fail('habitatLocked');
  const cost = carriagePrice(ctx.idx, s.currentLine, s.carriages.length + 1);
  return okCheck(cost, () => {
    const car = newCarriage(ctx, a.habitat, false);
    s.carriages.push(car);
    ctx.emit({ type: 'purchase', item: 'carriage', cost, refId: a.habitat, carId: car.id });
    ctx.invalidate();
  });
}

export function checkChangeHabitat(ctx: Ctx, a: A<'changeHabitat'>): Check {
  const s = ctx.state;
  const car = findCar(ctx, a.carId);
  if (!car) return fail('unknownCar');
  if (car.habitat === a.habitat) return fail('sameHabitat');
  if (!habitatsForLine(ctx.idx, s.currentLine).includes(a.habitat)) return fail('habitatLocked');
  const cost = habitatChangeCost(ctx.idx, s.currentLine, carIndex(ctx, car.id) + 1);
  return okCheck(cost, () => {
    car.habitat = a.habitat;
    const bd = ctx.idx.data.cosmetics.backdrops.find((b) => b.id === car.cosmetics.backdrop);
    if (!bd || bd.habitat !== a.habitat) car.cosmetics.backdrop = defaultBackdrop(ctx.idx, a.habitat);
    ctx.emit({ type: 'purchase', item: 'habitat', cost, refId: a.habitat, carId: car.id });
    ctx.invalidate();
  });
}

export function checkBuySlot(ctx: Ctx, a: A<'buySlot'>): Check {
  const s = ctx.state;
  const car = findCar(ctx, a.carId);
  if (!car) return fail('unknownCar');
  if (car.slots >= ctx.idx.data.config.maxSlots) return fail('maxSlots');
  const cost = slotCost(ctx.idx, s.currentLine, carIndex(ctx, car.id) + 1, car.extraSlots);
  return okCheck(cost, () => {
    car.slots++;
    car.extraSlots++;
    ctx.emit({ type: 'purchase', item: 'slot', cost, refId: String(car.slots), carId: car.id });
    ctx.invalidate();
  });
}

export function checkBuildTrack(ctx: Ctx): Check {
  const s = ctx.state;
  if (s.builtTo >= ctx.idx.data.config.stationsPerLine) return fail('trackComplete');
  const k = s.builtTo + 1;
  const cost = trackCost(ctx.idx, s.currentLine, k);
  return okCheck(cost, () => {
    s.builtTo = k;
    ctx.emit({ type: 'trackBuilt', station: k, cost });
  });
}

/** Decor sold on the current line or an earlier one (market rotation is T-06). */
export function decorAvailable(ctx: Ctx, decorId: string): boolean {
  const d = ctx.idx.decor.get(decorId);
  if (!d || d.baseCost === null) return false;
  const pl = poolLine(d.pool);
  return pl > 0 && pl <= ctx.state.currentLine;
}

export function checkBuyDecor(ctx: Ctx, a: A<'buyDecor'>): Check {
  if (!ctx.idx.decor.has(a.decorId)) return fail('unknownDecor');
  if (!decorAvailable(ctx, a.decorId)) return fail('unavailable');
  const cost = decorCost(ctx.idx, ctx.state, a.decorId);
  if (cost === null) return fail('unavailable');
  return okCheck(cost, () => {
    const s = ctx.state;
    s.decorOwned[a.decorId] = (s.decorOwned[a.decorId] ?? 0) + 1;
    s.decorBought[a.decorId] = (s.decorBought[a.decorId] ?? 0) + 1;
    ctx.emit({ type: 'purchase', item: 'decor', cost, refId: a.decorId });
  });
}

/** Owned copies of a decor item not placed in any car. */
export function decorInTray(ctx: Ctx, decorId: string): number {
  let placed = 0;
  for (const c of ctx.state.carriages) for (const d of c.decor) if (d.id === decorId) placed++;
  return (ctx.state.decorOwned[decorId] ?? 0) - placed;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function sanePlacement(p: Partial<DecorPlacement>): boolean {
  for (const k of ['x', 'y', 'scale'] as const) if (p[k] !== undefined && !Number.isFinite(p[k])) return false;
  if (p.layer !== undefined && p.layer !== 'back' && p.layer !== 'front') return false;
  return true;
}

function normalise(p: DecorPlacement): DecorPlacement {
  return { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1), layer: p.layer as DecorLayer, scale: clamp(p.scale, 0.8, 1.2), flip: !!p.flip };
}

export function checkPlaceDecor(ctx: Ctx, a: A<'placeDecor'>): Check {
  const car = findCar(ctx, a.carId);
  if (!car) return fail('unknownCar');
  const d = ctx.idx.decor.get(a.decorId);
  if (!d) return fail('unknownDecor');
  if (!sanePlacement(a)) return fail('invalid');
  if (decorInTray(ctx, a.decorId) < 1) return fail('noCopy');
  if (decorUsed(ctx.idx, car) + d.capacity > decorCapacity(ctx.idx, car)) return fail('noCapacity');
  return okCheck(0, () => {
    car.decor.push({ id: a.decorId, ...normalise(a) });
    ctx.emit({ type: 'decorChanged', carId: car.id });
    ctx.refreshBonds();
  });
}

export function checkMoveDecor(ctx: Ctx, a: A<'moveDecor'>): Check {
  const car = findCar(ctx, a.carId);
  if (!car) return fail('unknownCar');
  const cur = car.decor[a.index];
  if (!cur) return fail('badIndex');
  if (!sanePlacement(a)) return fail('invalid');
  return okCheck(0, () => {
    const next = normalise({
      x: a.x ?? cur.x, y: a.y ?? cur.y, layer: a.layer ?? cur.layer, scale: a.scale ?? cur.scale, flip: a.flip ?? cur.flip,
    });
    car.decor[a.index] = { id: cur.id, ...next };
    ctx.emit({ type: 'decorChanged', carId: car.id });
  });
}

export function checkRemoveDecor(ctx: Ctx, a: A<'removeDecor'>): Check {
  const car = findCar(ctx, a.carId);
  if (!car) return fail('unknownCar');
  if (!car.decor[a.index]) return fail('badIndex');
  return okCheck(0, () => {
    car.decor.splice(a.index, 1);
    ctx.emit({ type: 'decorChanged', carId: car.id });
    ctx.refreshBonds();
  });
}

export function checkSetCosmetic(ctx: Ctx, a: A<'setCosmetic'>): Check {
  const car = findCar(ctx, a.carId);
  if (!car) return fail('unknownCar');
  const c = ctx.idx.data.cosmetics;
  if (a.kind === 'sand' && !c.sand.some((x) => x.id === a.value)) return fail('unknownCosmetic');
  if (a.kind === 'paint' && !c.paints.some((x) => x.id === a.value)) return fail('unknownCosmetic');
  if (a.kind === 'backdrop') {
    const b = c.backdrops.find((x) => x.id === a.value);
    if (!b) return fail('unknownCosmetic');
    if (b.habitat !== car.habitat) return fail('invalid');
    if (!b.isDefault && b.unlockable && !ctx.state.permanent.unlockedCosmetics.includes(b.id)) return fail('locked');
  }
  return okCheck(0, () => {
    car.cosmetics[a.kind] = a.value;
    ctx.emit({ type: 'cosmeticChanged', carId: car.id, kind: a.kind, value: a.value });
  });
}
