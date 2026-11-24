// Shared mutable context passed to every sim system: data, state, event queue and
// a lazily recomputed income model. T-06 systems take the same Ctx.
import { bondKey } from './bonds';
import { computeTrain, type TrainModel } from './income';
import type { DataIndex } from './lookup';
import type { BondInfo, SimEvent, SimState } from './types';
import { upgradeFx, type UpgradeFx } from './upgrades';

export interface Ctx {
  readonly idx: DataIndex;
  state: SimState;
  events: SimEvent[];
  emit(e: SimEvent): void;
  fx(): UpgradeFx;
  model(): TrainModel;
  /** Call after any change to fish, carriages, decor, upgrades or permanent mults. */
  invalidate(): void;
  /** Recompute now and emit bondFormed/bondBroken for the diff. */
  refreshBonds(): void;
}

export function createCtx(idx: DataIndex, state: SimState): Ctx {
  let fxCache: UpgradeFx | null = null;
  let modelCache: TrainModel | null = null;
  let bondKeys: Set<string> | null = null;

  const keysOf = (m: TrainModel): Map<string, { carId: string; b: BondInfo }> => {
    const out = new Map<string, { carId: string; b: BondInfo }>();
    for (const c of m.cars) for (const b of c.bonds.active) out.set(bondKey(c.carId, b), { carId: c.carId, b });
    return out;
  };

  const ctx: Ctx = {
    idx,
    state,
    events: [],
    emit(e) { ctx.events.push(e); },
    fx() { return (fxCache ??= upgradeFx(idx, ctx.state)); },
    model() {
      if (!modelCache) {
        modelCache = computeTrain(idx, ctx.state, ctx.fx());
        if (!bondKeys) bondKeys = new Set(keysOf(modelCache).keys());
      }
      return modelCache;
    },
    invalidate() { fxCache = null; modelCache = null; },
    refreshBonds() {
      const prev = bondKeys ?? new Set<string>();
      ctx.invalidate();
      bondKeys = null;
      const now = keysOf(ctx.model());
      for (const k of prev) {
        if (now.has(k)) continue;
        const [carId, kind, bondId, ids] = k.split('|') as [string, 'pair' | 'community', string, string];
        ctx.emit({ type: 'bondBroken', carId, kind, bondId, species: bondSpecies(idx, kind, bondId), fishIds: ids.split(',') });
      }
      for (const [k, { carId, b }] of now) {
        if (prev.has(k)) continue;
        ctx.emit({ type: 'bondFormed', carId, kind: b.kind, bondId: b.bondId, species: b.species, fishIds: b.fishIds });
      }
      bondKeys = new Set(now.keys());
    },
  };
  return ctx;
}

function bondSpecies(idx: DataIndex, kind: 'pair' | 'community', bondId: string): string[] {
  if (kind === 'pair') return bondId.split('+');
  return [...(idx.data.bonds.communities.find((c) => c.id === bondId)?.members ?? [])];
}
