// Aggregates permanent Depot Upgrade effects into one flat object (hooks for T-06).
import type { DataIndex } from './lookup';
import type { SimState } from './types';

export interface UpgradeFx {
  legSeconds: number | null;
  speciesCostMult: number;
  startSlots: number | null;
  fareMult: number;
  pairBonusPP: number;
  communityBonusPP: number;
  startShellsPerTicket: number;
  sightFrequencyMult: number;
  offline: { capHours: number; rate: number } | null;
}

export function upgradeFx(idx: DataIndex, state: SimState): UpgradeFx {
  const fx: UpgradeFx = {
    legSeconds: null, speciesCostMult: 1, startSlots: null, fareMult: 1, pairBonusPP: 0,
    communityBonusPP: 0, startShellsPerTicket: 0, sightFrequencyMult: 1, offline: null,
  };
  for (const id of state.permanent.upgrades) {
    const u = idx.upgrades.get(id);
    if (!u) continue;
    for (const e of u.effects) {
      switch (e.type) {
        case 'legSeconds': fx.legSeconds = fx.legSeconds === null ? e.value : Math.min(fx.legSeconds, e.value); break;
        case 'speciesCostMult': fx.speciesCostMult *= e.value; break;
        case 'startSlots': fx.startSlots = Math.max(fx.startSlots ?? 0, e.value); break;
        case 'fareMult': fx.fareMult *= e.value; break;
        case 'pairBonusPP': fx.pairBonusPP += e.value; break;
        case 'communityBonusPP': fx.communityBonusPP += e.value; break;
        case 'startShellsPerTicket': fx.startShellsPerTicket += e.value; break;
        case 'sightFrequencyMult': fx.sightFrequencyMult *= e.value; break;
        case 'offline': fx.offline = { capHours: e.capHours, rate: e.rate }; break;
      }
    }
  }
  return fx;
}

export function legSeconds(idx: DataIndex, fx: UpgradeFx): number {
  return fx.legSeconds ?? idx.data.config.legSeconds;
}

export function ticketMult(idx: DataIndex, state: SimState): number {
  return 1 + idx.data.config.ticketIncomePerTicket * state.permanent.totalTicketsEarned;
}
