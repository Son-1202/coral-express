// Common bot interface (SPEC E1). Bots are pure TS (no DOM) so the balance harness
// and `window.__debug.runBot(name)` can share them.
import type { GameData } from '../data/schema';
import type { Action, Sim, StoryData } from '../sim';

export interface Bot {
  readonly name: BotName;
  /**
   * Called once per sim-second (t = whole sim-seconds of active play since the bot
   * started). Returns the actions to apply now, in order. Feeding and Sight taps are
   * returned here too, on each bot's own cadence.
   */
  decide(sim: Sim, t: number): Action[];
}

export type BotName = 'random' | 'greedy' | 'bondNever';
export const BOT_NAMES: readonly BotName[] = ['random', 'greedy', 'bondNever'];

export interface BotOptions {
  data: GameData;
  /** Story (requests) the sim was created with; lets bots see request conditions. */
  story?: StoryData;
  /** Seed for the bot's own RNG (never consumes the sim's RNG). */
  seed: number;
}
