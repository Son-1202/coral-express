// E1 headless balance harness (SPEC E1, ticket T-07).
//   npx tsx scripts/balance.ts [--games N] [--bot name[,name]] [--minutes 120] [--offline-at 30]
//                              [--offline-hours 8] [--seed 1] [--workers K] [--out docs/qa/balance_report]
// Bots: greedy, random, bondNever, greedyOffline (greedy + one offline break). Default: all, 5000 games each.
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { loadGameData } from '../src/data/schema';
import { VARIANTS, type GameRecord, type GameSpec, type Variant } from './balance/game';
import { summarize } from './balance/metrics';
import { writeReport } from './balance/report';
import type { Task, TaskResult } from './balance/worker';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : def;
}

const games = Number(arg('games', '5000'));
const minutes = Number(arg('minutes', '120'));
const offlineAt = Number(arg('offline-at', '30'));
const offlineHours = Number(arg('offline-hours', '8'));
const seedBase = Number(arg('seed', '1'));
const workers = Math.max(1, Number(arg('workers', String(availableParallelism()))));
const out = arg('out', 'docs/qa/balance_report');
const botArg = arg('bot', 'all');
const bots: Variant[] = botArg === 'all' ? [...VARIANTS] : (botArg.split(',') as Variant[]);
for (const b of bots) if (!VARIANTS.includes(b)) throw new Error(`unknown bot ${b} (use ${VARIANTS.join(', ')})`);
if (!(games > 0) || !(minutes > 0)) throw new Error('--games and --minutes must be > 0');

const BATCH = 10;
const tasks: Task[] = [];
// Interleave variants so slow and fast bots are spread over the workers.
for (let i = 0; i < games; i += BATCH) {
  for (const variant of bots) {
    const specs: GameSpec[] = [];
    for (let k = i; k < Math.min(games, i + BATCH); k++) specs.push({ variant, seed: seedBase + k, minutes, offlineAt, offlineHours });
    tasks.push({ id: tasks.length, specs });
  }
}

const t0 = Date.now();
const records: GameRecord[] = [];
let next = 0;
let done = 0;
let lastLog = 0;

await new Promise<void>((resolve, reject) => {
  let alive = Math.min(workers, tasks.length);
  for (let w = 0; w < alive; w++) {
    const worker = new Worker(new URL('./balance/worker.ts', import.meta.url));
    const feed = (): void => { worker.postMessage(next < tasks.length ? tasks[next++]! : null); };
    worker.on('message', (m: TaskResult) => {
      records.push(...m.records);
      done++;
      const now = Date.now();
      if (now - lastLog > 5000 || done === tasks.length) {
        lastLog = now;
        process.stdout.write(`  ${done}/${tasks.length} batches, ${((now - t0) / 1000).toFixed(0)} s\n`);
      }
      feed();
    });
    worker.on('error', reject);
    worker.on('exit', () => { if (--alive === 0) resolve(); });
    feed();
  }
});

const by: Partial<Record<Variant, GameRecord[]>> = {};
for (const r of records.sort((a, b) => a.seed - b.seed)) (by[r.variant] ??= []).push(r);
const gameData = loadGameData();
const speciesIds = gameData.species.map((s) => s.id);
// Grand Terminus signature species: sold only at the ending station (PM, T-20).
const maxLine = Math.max(...gameData.lines.map((l) => l.id));
const terminusOnly = gameData.species.filter((s) => s.line === maxLine && s.station === gameData.config.stationsPerLine).map((s) => s.id);
const summary = summarize(by, speciesIds, minutes, terminusOnly);
const seconds = (Date.now() - t0) / 1000;
writeReport(out, summary, { games, bots, minutes, offlineAt, offlineHours, seedBase, workers, seconds });
for (const r of summary.rows) console.log(`${r.pass === null ? '  -  ' : r.pass ? 'PASS ' : 'FAIL '} ${r.metric}: ${r.value}`);
console.log(`illegal actions: ${JSON.stringify(summary.illegal)}`);
console.log(`wrote ${out}.md / .json in ${seconds.toFixed(0)} s`);
