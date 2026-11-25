// T-20 rule changes: Lines open after N terminal runs, per-Line Ticket divisor,
// saturating fare appeal, fares scale with each carriage's fish output.
import { describe, expect, it } from 'vitest';
import type { GameData } from '../../../src/data/schema';
import { createSimInternal, type SimInternals } from '../../../src/sim';
import { fareAppeal } from '../../../src/sim/income';
import { buildIndex } from '../../../src/sim/lookup';
import { addFish, data, give, heritage, noSights, setLine } from './helpers';

function makeWith(edit: (d: GameData) => void, seed = 1): SimInternals {
  const d = structuredClone(data);
  edit(d);
  const t = createSimInternal(d, { seed });
  noSights(t);
  return t;
}

/** Build track to the terminal and ride until it is reached. */
function reachTerminal(t: SimInternals): void {
  give(t, 1e12);
  while (t.ctx.state.builtTo < 6) expect(t.sim.act({ type: 'buildTrack' }).ok).toBe(true);
  for (let i = 0; i < 12 && !t.ctx.state.terminalReachedThisRun; i++) t.sim.advance(51);
  expect(t.ctx.state.terminalReachedThisRun).toBe(true);
}

describe('T-20 rules', () => {
  it('a Line opens after its previous terminal was reached in opensAfterRuns runs', () => {
    const t = makeWith((d) => { d.lines[1]!.opensAfterRuns = 2; });
    const fish = addFish(t, 'pebble_damsel', heritage(t));
    reachTerminal(t);
    let ev = t.sim.drainEvents();
    expect(ev.find((e) => e.type === 'terminalReached')).toEqual({ type: 'terminalReached', line: 1, firstTime: true });
    expect(ev.some((e) => e.type === 'lineOpened')).toBe(false);
    expect(t.ctx.state.permanent.terminalRuns['1']).toBe(1);
    expect(t.ctx.state.permanent.openedLines).toEqual([1]);
    t.ctx.state.runShells = 1e7;
    expect(t.sim.act({ type: 'depotReset', mascotFishId: fish, nextLine: 1 }).ok).toBe(true);
    reachTerminal(t);
    ev = t.sim.drainEvents();
    expect(ev.find((e) => e.type === 'terminalReached')).toEqual({ type: 'terminalReached', line: 1, firstTime: false });
    expect(ev.find((e) => e.type === 'lineOpened')).toEqual({ type: 'lineOpened', line: 2 });
    expect(t.ctx.state.permanent.terminalRuns['1']).toBe(2);
  });

  it('Tickets use the current Line ticketDivisor (fallback config divisor)', () => {
    const t = makeWith((d) => { d.lines[1]!.ticketDivisor = 1e9; });
    t.ctx.state.runShells = 4e9;
    expect(t.sim.projectedTickets()).toBe(Math.floor(Math.sqrt(4e9 / 1e5))); // line 1: config divisor
    setLine(t, 2);
    expect(t.sim.projectedTickets()).toBe(2);
  });

  it('fare uses fareAppeal(appeal) × car Sps; fareAppealHalf saturates it', () => {
    const idxLinear = buildIndex(data);
    expect(fareAppeal(idxLinear, 30)).toBe(30);
    const t = makeWith((d) => { d.config.fareAppealHalf = 60; });
    expect(fareAppeal(t.ctx.idx, 60)).toBeCloseTo(30);
    expect(fareAppeal(t.ctx.idx, 0)).toBe(0);
    addFish(t, 'clownfish', heritage(t)); // appeal 4, 9 Sps
    const A = 4 * 60 / (4 + 60);
    expect(t.sim.stats().nextFare).toBeCloseTo(A * 9 * 8 * 1.4); // next stop: station 2
    // An empty car pays nothing even with decor appeal; fares follow the fish.
    expect(t.ctx.model().fareWeight).toBeCloseTo(A * 9);
  });
});
