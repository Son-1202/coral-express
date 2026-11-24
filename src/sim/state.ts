// Initial state + run setup. `startRun` is reused by Depot Reset (T-06).
import type { Habitat, LineId } from '../data/schema';
import type { Ctx } from './ctx';
import type { DataIndex } from './lookup';
import { lineDef } from './lookup';
import { seedToState } from './rng';
import { visitStation } from './train';
import { SAVE_VERSION, type Carriage, type CarCosmetics, type PermanentState, type SimState } from './types';

export function defaultBackdrop(idx: DataIndex, habitat: Habitat): string {
  const b = idx.data.cosmetics.backdrops;
  return (b.find((x) => x.habitat === habitat && x.isDefault) ?? b.find((x) => x.habitat === habitat))?.id ?? '';
}

export function defaultCosmetics(idx: DataIndex, habitat: Habitat): CarCosmetics {
  const c = idx.data.cosmetics;
  return { sand: c.sand[0]?.id ?? '', paint: c.paints[0]?.id ?? '', backdrop: defaultBackdrop(idx, habitat) };
}

export function newId(state: SimState, prefix: 'f' | 'c'): string {
  return `${prefix}${state.nextId++}`;
}

export function startSlots(ctx: Ctx): number {
  return Math.min(ctx.fx().startSlots ?? ctx.idx.data.config.startSlots, ctx.idx.data.config.maxSlots);
}

export function newCarriage(ctx: Ctx, habitat: Habitat, heritage: boolean): Carriage {
  return {
    id: newId(ctx.state, 'c'), habitat, slots: startSlots(ctx), extraSlots: 0, fish: [], decor: [],
    cosmetics: defaultCosmetics(ctx.idx, habitat), heritage,
  };
}

function defaultPermanent(): PermanentState {
  return {
    tickets: 0, totalTicketsEarned: 0, upgrades: [], openedLines: [1], stamps: [], postcards: [],
    unlockedCosmetics: [], mascot: null, oldFriendStreak: 0, oldFriend: false, endless: false,
    reachedTerminals: [], resets: 0,
  };
}

/** Blank state (no run started yet). */
export function blankState(seed: number): SimState {
  return {
    version: SAVE_VERSION, time: 0, tickAcc: 0, ticks: 0, rngState: seedToState(seed), nextId: 1,
    shells: 0, runShells: 0,
    lifetime: { shellsEarned: 0, fishShells: 0, fareShells: 0, arrivals: 0, fishBought: 0, levelsBought: 0, playSeconds: 0 },
    currentLine: 1, builtTo: 2, marketStation: 1, visitedThisRun: [], terminalReachedThisRun: false,
    train: { fromStation: 1, toStation: 1, phase: 'stopped', t: 0, dir: 1 },
    carriages: [], fish: {}, copiesOwned: {}, speciesBoughtThisRun: [], decorOwned: {}, decorBought: {},
    frenzy: {}, modifiers: [], permanent: defaultPermanent(), incomeWindow: { seconds: 0, amount: 0 },
  };
}

/**
 * Start a run on `line`: resets Shells, fish, carriages (except Heritage, which keeps
 * habitat/decor/cosmetics but loses fish and extra slots), track and train.
 * Permanent progress is untouched. Mascot placement is T-06's job.
 */
export function startRun(ctx: Ctx, line: LineId): void {
  const s = ctx.state;
  const cfg = ctx.idx.data.config;
  const l = lineDef(ctx.idx, line);
  s.currentLine = line;
  ctx.invalidate();
  const old = s.carriages.find((c) => c.heritage);
  const heritage = old ?? newCarriage(ctx, l.habitats[0] ?? 'reef', true);
  heritage.fish = [];
  heritage.extraSlots = 0;
  heritage.slots = startSlots(ctx);
  s.carriages = [heritage];
  s.fish = {};
  s.copiesOwned = {};
  s.speciesBoughtThisRun = [];
  s.decorOwned = {};
  for (const d of heritage.decor) s.decorOwned[d.id] = (s.decorOwned[d.id] ?? 0) + 1;
  s.decorBought = {};
  s.frenzy = {};
  s.modifiers = [];
  s.shells = cfg.startShells + ctx.fx().startShellsPerTicket * s.permanent.totalTicketsEarned;
  s.runShells = 0;
  s.builtTo = Math.min(cfg.startTrackStation, cfg.stationsPerLine);
  s.visitedThisRun = [];
  s.terminalReachedThisRun = false;
  s.train = { fromStation: 1, toStation: 1, phase: 'stopped', t: 0, dir: 1 };
  ctx.invalidate();
  ctx.refreshBonds();
  visitStation(ctx, 1);
}
