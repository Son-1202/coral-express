// Bot registry (SPEC E1). Also used by `window.__debug.runBot(name)`.
import { createGreedyBot } from './greedy';
import { createRandomBot } from './random';
import type { Bot, BotName, BotOptions } from './types';

export type { Bot, BotName, BotOptions } from './types';
export { BOT_NAMES } from './types';
export { runBotSecond, type StepResult } from './driver';

export function createBot(name: BotName, opts: BotOptions): Bot {
  switch (name) {
    case 'random': return createRandomBot(opts);
    case 'greedy': return createGreedyBot(opts, 'greedy');
    case 'bondNever': return createGreedyBot(opts, 'bondNever');
  }
}
