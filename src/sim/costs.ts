// Pure cost formulas (SPEC B4.2–B4.4, B5.3). All numbers come from data.
import type { LineId, SpeciesDef } from '../data/schema';
import { lineDef, type DataIndex } from './lookup';
import type { SimState } from './types';
import type { UpgradeFx } from './upgrades';

/** Track extension to station k (k ≥ 2): trackBase × trackGrowth^(k-2). */
export function trackCost(idx: DataIndex, line: LineId, k: number): number {
  const l = lineDef(idx, line);
  return l.trackBase * Math.pow(l.trackGrowth, k - 2);
}

/**
 * Price of carriage number n (1-based): carriageBase × growth^(n-2) × fareMult_line.
 * n = 1 (Heritage) uses the same formula (base / growth) so habitat-change and
 * slot costs are defined for it too.
 */
export function carriagePrice(idx: DataIndex, line: LineId, n: number): number {
  const c = idx.data.config;
  return c.carriageBase * Math.pow(c.carriageGrowth, n - 2) * lineDef(idx, line).fareMult;
}

/** Extra slot: slotCostFactor × carriagePrice × slotGrowth^extraSlotsBought. */
export function slotCost(idx: DataIndex, line: LineId, n: number, extraSlots: number): number {
  const c = idx.data.config;
  return c.slotCostFactor * carriagePrice(idx, line, n) * Math.pow(c.slotGrowth, extraSlots);
}

export function habitatChangeCost(idx: DataIndex, line: LineId, n: number): number {
  return idx.data.config.habitatChangeFactor * carriagePrice(idx, line, n);
}

/** Next copy of a species: baseCost × copyGrowth^copiesOwned × speciesCostMult; first Pebble Damsel free. */
export function copyCost(idx: DataIndex, state: SimState, sp: SpeciesDef, fx: UpgradeFx): number {
  const owned = state.copiesOwned[sp.id] ?? 0;
  if (sp.flags.firstFree && owned === 0 && !state.speciesBoughtThisRun.includes(sp.id)) return 0;
  return sp.baseCost * Math.pow(idx.data.config.copyCostGrowth, owned) * fx.speciesCostMult;
}

/** Level-up from `level` to `level + 1`: baseCost × levelGrowth^level. */
export function levelCost(idx: DataIndex, baseCost: number, level: number): number {
  return baseCost * Math.pow(idx.data.config.levelCostGrowth, level);
}

/** Sum of `times` consecutive level-ups starting at `level`. */
export function levelsCost(idx: DataIndex, baseCost: number, level: number, times: number): number {
  let sum = 0;
  for (let i = 0; i < times; i++) sum += levelCost(idx, baseCost, level + i);
  return sum;
}

/** Decor copy: baseCost × decorCopyGrowth^copiesBought; null when not purchasable. */
export function decorCost(idx: DataIndex, state: SimState, decorId: string): number | null {
  const d = idx.decor.get(decorId);
  if (!d || d.baseCost === null) return null;
  return d.baseCost * Math.pow(idx.data.config.decorCopyGrowth, state.decorBought[decorId] ?? 0);
}

export function milestoneMult(idx: DataIndex, level: number): number {
  const m = idx.data.config.milestones;
  let n = 0;
  for (const l of m.levels) if (level >= l) n++;
  return Math.pow(m.mult, n);
}
