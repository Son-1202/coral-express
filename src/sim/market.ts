// Station markets (SPEC B4.12): fish stall, decor stall, Today's Special, Requests board.
// Built on every station visit (seeded RNG), open until the next arrival.
import { fail, findCar, okCheck, type Check } from './actionCheck';
import type { Ctx } from './ctx';
import { poolLine, stationId } from './lookup';
import { baseIncome } from './rates';
import { rand } from './rng';
import type { Action, SpecialKind, TodaysSpecial } from './types';

/** Fallback floor price of Today's Special when config.todaysSpecial.minPrice is absent. */
export const SPECIAL_MIN_PRICE = 50;

/** config.todaysSpecial.minPrice (optional; not yet in schema.ts — CONTENT may add it). */
export function specialMinPrice(ctx: Ctx): number {
  const v = (ctx.idx.data.config.todaysSpecial as { minPrice?: unknown }).minPrice;
  return typeof v === 'number' && Number.isFinite(v) ? v : SPECIAL_MIN_PRICE;
}
/** Earlier-station species offered next to the signature one (SPEC B4.12). */
const EARLIER_FISH = 2;
const DECOR_STALL = 3;

function pick<T>(ctx: Ctx, arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.min(arr.length - 1, Math.floor(rand(ctx.state) * arr.length))];
}

/** Signature species of the station, then the signatures of the 2 previous stations (deterministic). */
export function fishStall(ctx: Ctx, station: number): string[] {
  const line = ctx.state.currentLine;
  const at = (k: number): string[] => ctx.idx.data.species.filter((sp) => sp.line === line && sp.station === k).map((sp) => sp.id);
  const out = at(station);
  for (let k = station - 1; k >= 1 && k >= station - EARLIER_FISH; k--) out.push(...at(k));
  return out;
}

function decorStall(ctx: Ctx): string[] {
  const line = ctx.state.currentLine;
  const pool = [...ctx.idx.decor.values()].filter((d) => d.baseCost !== null && poolLine(d.pool) === line).map((d) => d.id);
  const out: string[] = [];
  while (out.length < DECOR_STALL && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(rand(ctx.state) * pool.length));
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}

function lockedBackdrops(ctx: Ctx): string[] {
  const u = ctx.state.permanent.unlockedCosmetics;
  return ctx.idx.data.cosmetics.backdrops.filter((b) => b.unlockable && !b.isDefault && !u.includes(b.id)).map((b) => b.id);
}

function rollSpecial(ctx: Ctx): TodaysSpecial | null {
  const s = ctx.state;
  const cfg = ctx.idx.data.config;
  const owned = s.speciesBoughtThisRun.filter((id) => (s.copiesOwned[id] ?? 0) > 0);
  const cosmetics = lockedBackdrops(ctx);
  const kinds: SpecialKind[] = ['shinyEgg'];
  if (owned.length) kinds.push('levelDiscount');
  if (s.carriages.some((c) => c.slots < cfg.maxSlots)) kinds.push('freeSlot');
  if (cosmetics.length) kinds.push('cosmetic');
  const kind = pick(ctx, kinds) ?? 'shinyEgg';
  const price = Math.max(specialMinPrice(ctx), cfg.todaysSpecial.priceSecondsOfIncome * baseIncome(ctx).totalSps);
  const sp: TodaysSpecial = { kind, price, sold: false };
  if (kind === 'levelDiscount') sp.species = pick(ctx, owned);
  if (kind === 'cosmetic') sp.cosmetic = pick(ctx, cosmetics);
  return sp;
}

export function openMarket(ctx: Ctx, station: number): void {
  const s = ctx.state;
  const sid = stationId(s.currentLine, station);
  s.market = {
    station, stationId: sid, fish: fishStall(ctx, station), decor: decorStall(ctx),
    special: rollSpecial(ctx), requests: [...(s.requestBoards[sid]?.ids ?? [])],
  };
  ctx.emit({ type: 'market', station, stationId: sid });
}

export function checkBuySpecial(ctx: Ctx, a: Extract<Action, { type: 'buySpecial' }>): Check {
  const s = ctx.state;
  const sp = s.market.special;
  if (!sp) return fail('unavailable');
  if (sp.sold) return fail('soldOut');
  const done = (target?: string): void => {
    sp.sold = true;
    ctx.emit({ type: 'specialBought', kind: sp.kind, cost: sp.price, ...(target !== undefined ? { target } : {}) });
  };
  switch (sp.kind) {
    case 'levelDiscount': {
      const id = sp.species;
      if (!id) return fail('invalid');
      return okCheck(sp.price, () => {
        s.levelDiscounts[id] = (s.levelDiscounts[id] ?? 0) + ctx.idx.data.config.todaysSpecial.levelDiscountCount;
        done(id);
      });
    }
    case 'shinyEgg': {
      const id = a.target;
      if (!id || !ctx.idx.species.has(id)) return fail('unknownSpecies');
      if (!s.speciesBoughtThisRun.includes(id) && s.market.fish[0] !== id) return fail('unavailable');
      return okCheck(sp.price, () => { s.shinyEggs.species.push(id); done(id); });
    }
    case 'freeSlot': {
      const car = a.target ? findCar(ctx, a.target) : undefined;
      if (!car) return fail('unknownCar');
      if (car.slots >= ctx.idx.data.config.maxSlots) return fail('maxSlots');
      return okCheck(sp.price, () => {
        car.slots++;
        car.extraSlots++;
        ctx.invalidate();
        done(car.id);
      });
    }
    case 'cosmetic': {
      const id = sp.cosmetic;
      if (!id) return fail('invalid');
      return okCheck(sp.price, () => {
        if (!s.permanent.unlockedCosmetics.includes(id)) s.permanent.unlockedCosmetics.push(id);
        done(id);
      });
    }
  }
}
