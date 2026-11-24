import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../../src/sim';
import { addFish, give, make, setLine } from './helpers';

const arrivals = (ev: SimEvent[]): number[] => ev.flatMap((e) => (e.type === 'arrive' ? [e.station] : []));

describe('train', () => {
  it('arrives every stop + leg seconds (6 + 45)', () => {
    const t = make();
    t.sim.drainEvents();
    t.sim.advance(50.75);
    expect(arrivals(t.sim.drainEvents())).toEqual([]);
    t.sim.advance(0.25);
    expect(arrivals(t.sim.drainEvents())).toEqual([2]);
    t.sim.advance(51);
    expect(arrivals(t.sim.drainEvents())).toEqual([1]);
  });

  it('shuttles 1..builtTo and reverses at both ends', () => {
    const t = make();
    give(t, 1e6);
    t.sim.act({ type: 'buildTrack' });
    t.sim.drainEvents();
    t.sim.advance(51 * 8);
    expect(arrivals(t.sim.drainEvents())).toEqual([2, 3, 2, 1, 2, 3, 2, 1]);
  });

  it('express engine shortens the leg', () => {
    const t = make();
    t.ctx.state.permanent.upgrades.push('express_engine');
    t.ctx.invalidate();
    t.sim.drainEvents();
    t.sim.advance(36);
    expect(arrivals(t.sim.drainEvents())).toEqual([2]);
  });

  it('pays fare = appeal × 8 × stationMult × fareMult × ticketMult at arrival', () => {
    const t = make();
    addFish(t, 'pebble_damsel');
    t.ctx.state.permanent.totalTicketsEarned = 5;
    t.ctx.invalidate();
    t.sim.drainEvents();
    expect(t.sim.stats().nextFare).toBeCloseTo(1 * 8 * 1.4 * 1 * 1.5);
    t.sim.advance(51);
    const fare = t.sim.drainEvents().find((e) => e.type === 'fare');
    expect(fare && fare.type === 'fare' && fare.amount).toBeCloseTo(16.8);
  });

  it('terminal on line 1 → terminalReached + lineOpened(2); stamps + postcards', () => {
    const t = make();
    give(t, 1e9);
    for (let i = 0; i < 4; i++) t.sim.act({ type: 'buildTrack' });
    t.sim.drainEvents();
    t.sim.advance(51 * 5);
    const ev = t.sim.drainEvents();
    expect(arrivals(ev)).toEqual([2, 3, 4, 5, 6]);
    expect(ev.find((e) => e.type === 'terminalReached')).toEqual({ type: 'terminalReached', line: 1, firstTime: true });
    expect(ev.find((e) => e.type === 'lineOpened')).toEqual({ type: 'lineOpened', line: 2 });
    expect(t.ctx.state.permanent.openedLines).toEqual([1, 2]);
    expect(t.ctx.state.permanent.postcards).toHaveLength(6);
    expect(t.ctx.state.permanent.stamps.filter((s) => s.startsWith('station:'))).toHaveLength(6);
    // second time in the same run: no new event
    t.sim.advance(51 * 10);
    expect(t.sim.drainEvents().some((e) => e.type === 'terminalReached')).toBe(false);
    // habitats of line 2 still locked while riding line 1
    expect(t.sim.act({ type: 'buyCarriage', habitat: 'kelp' })).toEqual({ ok: false, reason: 'habitatLocked' });
  });

  it('line 3 terminal → ending + endless (fares ×2); final postcard suppressToast', () => {
    const t = make();
    setLine(t, 3);
    addFish(t, 'tubeworm');
    give(t, 1e15);
    for (let i = 0; i < 4; i++) expect(t.sim.act({ type: 'buildTrack' }).ok).toBe(true);
    t.sim.drainEvents();
    t.sim.advance(51 * 5);
    const ev = t.sim.drainEvents();
    expect(ev.some((e) => e.type === 'ending')).toBe(true);
    expect(ev.some((e) => e.type === 'lineOpened')).toBe(false);
    const pc = ev.filter((e) => e.type === 'postcard');
    expect(pc[pc.length - 1]).toEqual({ type: 'postcard', stationId: 'l3s6', suppressToast: true });
    expect(t.ctx.state.permanent.endless).toBe(true);
    // next arrival is station 5: tubeworm appeal 5 off-habitat (reef car) → 2.5
    expect(t.sim.stats().nextFare).toBeCloseTo(2.5 * 8 * 4 * 600 * 2);
  });
});
