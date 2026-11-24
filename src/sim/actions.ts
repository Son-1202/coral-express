// Action registry. Adding an Action variant (T-06) without a checker here is a type error.
import type { Check } from './actionCheck';
import {
  checkBuildTrack, checkBuyCarriage, checkBuyDecor, checkBuySlot, checkChangeHabitat,
  checkMoveDecor, checkPlaceDecor, checkRemoveDecor, checkSetCosmetic,
} from './actionsCar';
import { checkBuyFish, checkFeed, checkLevelFish, checkMoveFish, checkSellFish } from './actionsFish';
import type { Ctx } from './ctx';
import type { Action, ActionResult, ActionType } from './types';

export type ActionChecker<T extends ActionType> = (ctx: Ctx, a: Extract<Action, { type: T }>) => Check;
export type ActionTable = { [K in ActionType]: ActionChecker<K> };

export const ACTIONS: ActionTable = {
  buyFish: checkBuyFish,
  levelFish: checkLevelFish,
  sellFish: checkSellFish,
  moveFish: checkMoveFish,
  buyCarriage: checkBuyCarriage,
  changeHabitat: checkChangeHabitat,
  buySlot: checkBuySlot,
  buildTrack: checkBuildTrack,
  feed: checkFeed,
  buyDecor: checkBuyDecor,
  placeDecor: checkPlaceDecor,
  moveDecor: checkMoveDecor,
  removeDecor: checkRemoveDecor,
  setCosmetic: checkSetCosmetic,
};

export function checkAction(ctx: Ctx, a: Action): Check {
  // The table is keyed by `type`, so the checker always matches the variant; TS can't
  // correlate the two through a union, hence the widening cast.
  const fn = ACTIONS[a.type] as ((ctx: Ctx, a: Action) => Check) | undefined;
  if (!fn) return { ok: false, reason: 'invalid' };
  return fn(ctx, a);
}

/** Cost of an action (negative = refund, 0 = free), null when it cannot be done. */
export function priceAction(ctx: Ctx, a: Action): number | null {
  const c = checkAction(ctx, a);
  return c.ok ? c.cost : null;
}

export function runAction(ctx: Ctx, a: Action): ActionResult {
  const c = checkAction(ctx, a);
  if (!c.ok) return { ok: false, reason: c.reason };
  if (c.cost > 0) {
    if (c.cost > ctx.state.shells) return { ok: false, reason: 'cantAfford' };
    ctx.state.shells -= c.cost;
  }
  c.apply();
  return { ok: true };
}
