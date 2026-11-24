// One second of bot play: decide, apply each action in order, advance the sim 1 s.
import type { Action, ActionResult, Sim } from '../sim';
import type { Bot } from './types';

export interface StepResult {
  actions: Action[];
  results: ActionResult[];
}

/** `before(a)` runs right before each action is applied (harness snapshots, e.g. pre-reset stats). */
export function runBotSecond(sim: Sim, bot: Bot, t: number, before?: (a: Action) => void): StepResult {
  const actions = bot.decide(sim, t);
  const results: ActionResult[] = [];
  for (const a of actions) {
    before?.(a);
    results.push(sim.act(a));
  }
  sim.advance(1);
  return { actions, results };
}
