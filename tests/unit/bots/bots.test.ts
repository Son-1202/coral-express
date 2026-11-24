import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { createSim, type StoryData } from '../../../src/sim';
import requestsJson from '../../../src/story/requests.json';
import { BOT_NAMES, createBot, runBotSecond, type BotName } from '../../../src/bots';
import { maxGap, runGame } from '../../../scripts/balance/game';
import { quantile } from '../../../scripts/balance/metrics';

const data = loadGameData();
const story = requestsJson as StoryData;

function play(name: BotName, seed: number, seconds: number) {
  const sim = createSim(data, { seed, story });
  const bot = createBot(name, { data, story, seed });
  const failures: string[] = [];
  let actions = 0;
  let spent = 0;
  let taps = 0;
  let missed = 0;
  for (let t = 0; t < seconds; t++) {
    const r = runBotSecond(sim, bot, t);
    actions += r.actions.length;
    r.results.forEach((x, i) => { if (!x.ok) failures.push(`${t} ${JSON.stringify(r.actions[i])} ${x.reason}`); });
    for (const e of sim.drainEvents()) {
      if (e.type === 'purchase' || e.type === 'levelUp') spent += e.cost;
      if (e.type === 'sightEnd' && e.sightId !== 'stowaway' && ['dolphin_race', 'seagull_thief'].includes(e.sightId)) { if (e.tapped) taps++; else missed++; }
    }
  }
  return { sim, failures, actions, spent, taps, missed };
}

describe('bots', () => {
  for (const name of BOT_NAMES) {
    it(`${name}: 10-min games never throw and never take illegal actions`, () => {
      for (const seed of [1, 2, 3]) {
        const g = play(name, seed, 600);
        expect(g.failures, `${name} seed ${seed}`).toEqual([]);
        expect(g.actions).toBeGreaterThan(20);
        expect(g.spent).toBeGreaterThan(0);
        expect(Number.isFinite(g.sim.state.shells)).toBe(true);
      }
    });
  }

  it('bots are deterministic per seed', () => {
    const a = play('greedy', 7, 300).sim.state;
    const b = play('greedy', 7, 300).sim.state;
    expect(a.shells).toBe(b.shells);
    expect(Object.keys(a.fish)).toEqual(Object.keys(b.fish));
  });

  it('greedy beats random on income at minute 15', () => {
    const inc = (v: 'greedy' | 'random'): number[] =>
      [1, 2, 3, 4, 5].map((seed) => runGame({ variant: v, seed, minutes: 15, offlineAt: 30, offlineHours: 8 }).income15);
    expect(quantile(inc('greedy'), 0.5)!).toBeGreaterThan(quantile(inc('random'), 0.5)!);
  });

  it('greedy taps sights and feeds every second it can', () => {
    const g = play('greedy', 3, 600);
    expect(g.taps).toBeGreaterThan(0);
    expect(g.missed).toBe(0);
    expect(g.sim.state.lifetime.sightLosses).toBe(0);
    expect(Object.keys(g.sim.state.frenzy).length).toBeGreaterThan(0);
  });
});

describe('harness helpers', () => {
  it('maxGap counts window edges', () => {
    expect(maxGap([], 300, 900)).toBe(600);
    expect(maxGap([400, 500, 850], 300, 900)).toBe(350);
    expect(maxGap([100, 1000], 300, 900)).toBe(600);
  });
  it('runGame records a short game without illegal actions', () => {
    const r = runGame({ variant: 'greedyOffline', seed: 1, minutes: 31, offlineAt: 30, offlineHours: 8 });
    expect(r.illegal).toBe(0);
    expect(r.offline).toBeGreaterThan(0);
    expect(r.played).toBeLessThanOrEqual(31 * 60);
  });
});
