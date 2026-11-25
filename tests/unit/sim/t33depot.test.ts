// T-33: an eligible Depot Reset grants at least 1 Ticket; depotPreview() feeds the Depot panel.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { createSimInternal, type SimInternals } from '../../../src/sim';
import { addFish, noSights } from './helpers';

/** Real (tuned) data: Line 1 ticketDivisor 8e6, minRunShells 1e6 — the producer's case. */
const real = loadGameData();
const div1 = real.lines.find((l) => l.id === 1)!.ticketDivisor!;
const min = real.config.depotReset.minRunShells;

function make(): SimInternals {
  const t = createSimInternal(real, { seed: 1 });
  noSights(t);
  return t;
}

function setRun(t: SimInternals, runShells: number, terminal: boolean): void {
  t.ctx.state.runShells = runShells;
  t.ctx.state.terminalReachedThisRun = terminal;
}

describe('T-33 depot ticket floor', () => {
  it('uses the real Line 1 numbers the rule is about', () => {
    expect(div1).toBeGreaterThan(min); // otherwise the floor would never matter
    expect(Math.floor(Math.sqrt(min / div1))).toBe(0);
  });

  it('eligible at minRunShells + terminal → exactly 1 Ticket (was 0)', () => {
    const t = make();
    setRun(t, min, true);
    expect(t.sim.canDepotReset()).toBe(true);
    expect(t.sim.projectedTickets()).toBe(1);
    const f = addFish(t, 'pebble_damsel');
    t.sim.drainEvents();
    expect(t.sim.act({ type: 'depotReset', mascotFishId: f, nextLine: 1 }).ok).toBe(true);
    expect(t.sim.drainEvents().find((e) => e.type === 'depotReset')).toMatchObject({ tickets: 1 });
    expect(t.ctx.state.permanent.tickets).toBe(1);
    expect(t.ctx.state.permanent.totalTicketsEarned).toBe(1);
  });

  it('producer case: 2.4M run Shells on Line 1 → 1 Ticket, reset allowed', () => {
    const t = make();
    setRun(t, 2.4e6, true);
    expect(t.sim.canDepotReset()).toBe(true);
    expect(t.sim.projectedTickets()).toBe(1);
  });

  it('below minRunShells or without the terminal → not eligible', () => {
    const t = make();
    setRun(t, min - 1, true);
    expect(t.sim.canDepotReset()).toBe(false);
    expect(t.sim.projectedTickets()).toBe(0);
    setRun(t, 1e9, false);
    expect(t.sim.canDepotReset()).toBe(false);
    const f = addFish(t, 'pebble_damsel');
    expect(t.sim.act({ type: 'depotReset', mascotFishId: f, nextLine: 1 })).toEqual({ ok: false, reason: 'notReady' });
  });

  it('large runs are unchanged: floor(sqrt(runShells / divisor))', () => {
    const t = make();
    for (const k of [2, 3, 6, 18, 54]) {
      setRun(t, k * k * div1, true);
      expect(t.sim.projectedTickets()).toBe(k);
      setRun(t, k * k * div1 - 1, true);
      expect(t.sim.projectedTickets()).toBe(k - 1);
    }
  });
});

describe('T-33 depotPreview', () => {
  it('fresh run: not eligible, furthest station 1, previews the grant at the gate (1 Ticket)', () => {
    const t = make();
    const pv = t.sim.depotPreview();
    expect(pv).toMatchObject({
      eligible: false, terminalReached: false, furthestStation: 1, terminalStation: real.config.stationsPerLine,
      runShells: 0, minRunShells: min, tickets: 1, nextTicketAt: 4 * div1, incomeMult: 1,
    });
    expect(t.sim.projectedTickets()).toBe(0); // the sim itself grants nothing below the gate
    expect(pv.incomeMultAfter).toBeCloseTo(1 + real.config.ticketIncomePerTicket);
  });

  it('tracks the furthest station visited this run', () => {
    const t = make();
    t.ctx.state.visitedThisRun = [1, 2, 4, 3];
    expect(t.sim.depotPreview().furthestStation).toBe(4);
  });

  it('nextTicketAt: grant just below it, grant + 1 at it (real per-Line divisors)', () => {
    for (const line of real.lines) {
      const t = make();
      t.ctx.state.currentLine = line.id;
      t.ctx.state.terminalReachedThisRun = true;
      for (const rs of [min, 2.4e6, 3 * line.ticketDivisor!, 40 * line.ticketDivisor!]) {
        t.ctx.state.runShells = rs;
        const pv = t.sim.depotPreview();
        expect(pv.tickets).toBe(t.sim.projectedTickets());
        expect(pv.nextTicketAt).toBeGreaterThan(rs);
        t.ctx.state.runShells = pv.nextTicketAt * (1 - 1e-12);
        expect(t.sim.projectedTickets()).toBe(pv.tickets);
        t.ctx.state.runShells = pv.nextTicketAt;
        expect(t.sim.projectedTickets()).toBe(pv.tickets + 1);
      }
    }
  });

  it('income multipliers follow ticketIncomePerTicket', () => {
    const t = make();
    t.ctx.state.permanent.totalTicketsEarned = 3;
    setRun(t, 36 * div1, true);
    const per = real.config.ticketIncomePerTicket;
    const pv = t.sim.depotPreview();
    expect(pv.eligible).toBe(true);
    expect(pv.tickets).toBe(6);
    expect(pv.incomeMult).toBeCloseTo(1 + per * 3);
    expect(pv.incomeMultAfter).toBeCloseTo(1 + per * 9);
  });
});
