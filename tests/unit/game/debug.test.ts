import { describe, expect, it } from 'vitest';
import { GameController } from '../../../src/game/controller';
import { createDebug } from '../../../src/game/debug';

describe('__debug.skipTo (QA bug 2)', () => {
  const make = () => {
    const game = new GameController({ fresh: true, noSave: true, seed: 7 });
    const debug = createDebug(game, { setTimeOfDay: () => {}, openPanel: () => {} }) as {
      skipTo(t: string): unknown;
    };
    return { game, debug };
  };

  it("skipTo('depotReset') projects at least 3 Tickets", () => {
    const { game, debug } = make();
    debug.skipTo('depotReset');
    expect(game.sim.projectedTickets()).toBeGreaterThanOrEqual(3);
  });

  it("skipTo('line2') grants Tickets on the way", () => {
    const { game, debug } = make();
    debug.skipTo('line2');
    expect(game.sim.state.currentLine).toBe(2);
    expect(game.sim.state.permanent.tickets).toBeGreaterThanOrEqual(3);
  });
});
