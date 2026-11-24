import type { LineId } from '../data/schema';
import type { GameController } from './controller';
import { TIME_NAMES, type TimeName } from '../render/timeOfDay';

export type SkipTarget = 'line2' | 'line3' | 'depotReset' | 'terminal' | 'ending';

export interface DebugHooks {
  setTimeOfDay(t: number | null): void;
  openPanel(id: string): void;
}

/**
 * `window.__debug` (SPEC C). skipTo works by scripted fast-forward: grant the
 * Shells for each step, take the action the player would take, and let the sim
 * run (train travels, terminals fire, Lines open) — no state is faked except
 * the debug Shells and, for depot resets, the run-Shells threshold.
 */
export function createDebug(game: GameController, hooks: DebugHooks): Record<string, unknown> {
  const sim = game.sim;
  const ctx = game.ctx;
  const s = () => ctx.state;

  const addShells = (n: number) => {
    s().shells += n;
    game.drain();
  };

  const ensureFish = (): string | null => {
    const owned = Object.keys(s().fish);
    if (owned.length) return owned[0] ?? null;
    const car = s().carriages[0];
    if (!car) return null;
    for (const sp of game.data.species) {
      const a = { type: 'buyFish' as const, species: sp.id, carId: car.id };
      const p = sim.price(a);
      if (p === null) continue;
      if (p > s().shells) s().shells = p;
      if (sim.act(a).ok) return Object.keys(s().fish)[0] ?? null;
    }
    return null;
  };

  /** Build the remaining track and ride until the terminal of the current line is reached. */
  const reachTerminal = () => {
    const per = game.data.config.stationsPerLine;
    let guard = 0;
    while (s().builtTo < per && guard++ < 20) {
      const p = sim.price({ type: 'buildTrack' });
      if (p === null) break;
      if (p > s().shells) s().shells = p;
      sim.act({ type: 'buildTrack' });
    }
    game.drain(true);
    let t = 0;
    const maxT = (per * 2 + 2) * (game.legSeconds() + game.stopSeconds());
    while (!s().terminalReachedThisRun && t < maxT) {
      game.fastForward(10);
      t += 10;
    }
  };

  const resetTo = (line: LineId) => {
    const fishId = ensureFish();
    const min = game.data.config.depotReset.minRunShells;
    if (s().runShells < min) s().runShells = min;
    if (!fishId) return false;
    const r = sim.act({ type: 'depotReset', mascotFishId: fishId, nextLine: line });
    game.drain(true);
    game.save();
    if (!r.ok) console.warn('[debug] depotReset failed', r);
    return r.ok;
  };

  const lineOpen = (l: LineId) => s().permanent.openedLines.includes(l);

  const skipTo = (target: SkipTarget) => {
    switch (target) {
      case 'terminal':
        reachTerminal();
        break;
      case 'depotReset':
        reachTerminal();
        ensureFish();
        if (s().runShells < game.data.config.depotReset.minRunShells) s().runShells = game.data.config.depotReset.minRunShells;
        hooks.openPanel('depot');
        break;
      case 'line2':
        if (!lineOpen(2)) {
          if (s().currentLine !== 1) resetTo(1);
          reachTerminal();
        }
        if (s().currentLine !== 2) resetTo(2);
        break;
      case 'line3':
        if (!lineOpen(3)) {
          skipTo('line2');
          reachTerminal();
        }
        if (s().currentLine !== 3) resetTo(3);
        break;
      case 'ending':
        skipTo('line3');
        reachTerminal();
        break;
    }
    game.save();
    return { line: s().currentLine, builtTo: s().builtTo, endless: s().permanent.endless };
  };

  let botOff: (() => void) | null = null;
  const runBot = async (name: string, seconds?: number) => {
    botOff?.();
    botOff = null;
    let mod: typeof import('../bots');
    try {
      mod = await import('../bots');
    } catch {
      console.warn('[debug] bots unavailable');
      return;
    }
    if (!(mod.BOT_NAMES as readonly string[]).includes(name)) {
      console.warn(`[debug] unknown bot "${name}" (${mod.BOT_NAMES.join(', ')})`);
      return;
    }
    const bot = mod.createBot(name as Parameters<typeof mod.createBot>[0], { data: game.data, story: game.story, seed: game.seed });
    if (seconds && seconds > 0) {
      for (let t = 0; t < seconds; t++) {
        mod.runBotSecond(sim, bot, t);
        if (t % 30 === 29) game.drain(true);
      }
      game.drain(true);
      return;
    }
    // live: one decision per real second
    let acc = 0;
    let t = 0;
    botOff = game.bus.on('frame', (e) => {
      acc += e.dt;
      if (acc < 1) return;
      acc -= 1;
      for (const a of bot.decide(sim, t++)) sim.act(a);
    });
  };

  return {
    get seed() {
      return game.seed;
    },
    game,
    sim,
    skipTo,
    forceWin: () => skipTo('ending'),
    runBot,
    stopBot: () => {
      botOff?.();
      botOff = null;
    },
    addShells,
    fastForward: (sec: number) => game.fastForward(sec),
    triggerSight: (id: string) => {
      const ok = sim.triggerSight(id);
      game.drain();
      return ok;
    },
    simulateOffline: (sec: number) => game.offline(sec),
    setTimeOfDay: (t: number | TimeName | null) => hooks.setTimeOfDay(t === null ? null : typeof t === 'number' ? t : TIME_NAMES[t]),
    setSpeed: (k: number) => {
      game.speed = Math.max(0, k);
    },
  };
}
