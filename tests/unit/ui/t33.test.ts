// T-33: Depot Reset checklist (replaces T-22c's vague "Earn more Shells" hint).
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { createSim, type DepotPreview } from '../../../src/sim';
import { depotChecklist } from '../../../src/ui/helpers';
import { formatNumber } from '../../../src/util/format';

const fmt = (n: number) => formatNumber(n);
const label = (i: number) => `S${i}`;

describe('depotChecklist', () => {
  it('producer case (2.4M run Shells, terminal reached on Line 1): both ✓, +1 Ticket, button allowed', () => {
    const sim = createSim(loadGameData(), { seed: 1 });
    sim.state.runShells = 2.4e6;
    sim.state.terminalReachedThisRun = true;
    sim.state.visitedThisRun = [1, 2, 3, 4, 5, 6];
    const pv = sim.depotPreview();
    const cl = depotChecklist(pv, fmt, label);
    expect(cl.rows.map((r) => r.ok)).toEqual([true, true]);
    expect(cl.rows[0]!.text).toBe('Reach the terminal (Station 6 · S6) this run');
    expect(cl.rows[1]!.text).toBe(`Earn ${fmt(1e6)} Shells this run: ${fmt(2.4e6)} / ${fmt(1e6)}`);
    expect(cl.summary).toBe(`Reset now: +1 Ticket · income ×1.0 → ×1.1 · next Ticket at ${fmt(pv.nextTicketAt)} Shells`);
    expect(cl.blocked).toBeNull();
  });

  it('not yet: shows the furthest station, run Shells progress and what is missing', () => {
    const pv: DepotPreview = {
      eligible: false, terminalReached: false, furthestStation: 4, terminalStation: 6, runShells: 9e5, minRunShells: 1e6,
      tickets: 1, nextTicketAt: 3.2e7, incomeMult: 1.1, incomeMultAfter: 1.2,
    };
    const cl = depotChecklist(pv, fmt, label);
    expect(cl.rows.map((r) => r.ok)).toEqual([false, false]);
    expect(cl.rows[0]!.text).toBe('Reach the terminal (Station 6 · S6) this run — furthest so far: Station 4 · S4');
    expect(cl.rows[1]!.text).toBe(`Earn ${fmt(1e6)} Shells this run: ${fmt(9e5)} / ${fmt(1e6)}`);
    expect(cl.summary).toBe(`When ready: +1 Ticket · income ×1.1 → ×1.2 · next Ticket at ${fmt(3.2e7)} Shells`);
    expect(cl.blocked).toBe(`To reset: reach Station 6 and earn ${fmt(1e5)} more Shells this run.`);
  });

  it('terminal reached but Shells short: only the Shells row is ✗', () => {
    const pv: DepotPreview = {
      eligible: false, terminalReached: true, furthestStation: 6, terminalStation: 6, runShells: 5e5, minRunShells: 1e6,
      tickets: 1, nextTicketAt: 3.2e7, incomeMult: 1, incomeMultAfter: 1.1,
    };
    const cl = depotChecklist(pv, fmt, label);
    expect(cl.rows.map((r) => r.ok)).toEqual([true, false]);
    expect(cl.blocked).toBe(`To reset: earn ${fmt(5e5)} more Shells this run.`);
  });
});
