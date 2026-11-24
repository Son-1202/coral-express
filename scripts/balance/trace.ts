// Debug trace of single bot games (T-20 tuning aid).
//   npx tsx scripts/balance/trace.ts [--bot greedy] [--seeds 1,2,3] [--minutes 120] [--verbose] [--offline-at 30]
// Prints one line per milestone event (track, terminal, line, reset) plus a per-game summary.
import { loadGameData } from '../../src/data/schema';
import { createSim, type StoryData } from '../../src/sim';
import requestsJson from '../../src/story/requests.json';
import { createBot, runBotSecond, type BotName } from '../../src/bots';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : def;
}
const bot = arg('bot', 'greedy') as BotName;
const seeds = arg('seeds', '1,2,3').split(',').map(Number);
const minutes = Number(arg('minutes', '120'));
const verbose = process.argv.includes('--verbose');
const offlineAt = Number(arg('offline-at', '-1'));
const data = loadGameData();
const story = requestsJson as StoryData;
const e = (v: number): string => v.toExponential(2);
const m = (t: number): string => (t / 60).toFixed(1).padStart(5);

for (const seed of seeds) {
  const sim = createSim(data, { seed, story });
  const b = createBot(bot, { data, story, seed });
  let runStart = 0;
  let lastSpend = 60;
  let dead = 0;
  let deadAt = 0;
  const lines: string[] = [];
  let t = 0;
  for (; t < minutes * 60; t++) {
    if (t === offlineAt * 60) { const r = sim.advanceOffline(8 * 3600); lines.push(`${m(t)} OFFLINE +${e(r.shells)}`); }
    runBotSecond(sim, b, t);
    const s = sim.state;
    let end = false;
    for (const ev of sim.drainEvents()) {
      if (ev.type === 'purchase' || ev.type === 'levelUp' || ev.type === 'trackBuilt' || ev.type === 'specialBought' || ev.type === 'upgradeBought') {
        if (t >= 60 && t - lastSpend > dead) { dead = t - lastSpend; deadAt = lastSpend; }
        lastSpend = t;
      }
      const st = sim.stats();
      if (ev.type === 'trackBuilt' || (verbose && ev.type === 'purchase' && ev.item !== 'decor')) {
        lines.push(`${m(t)} [run ${m(t - runStart)}] L${s.currentLine} ${ev.type === 'trackBuilt' ? `track→${s.builtTo}` : `${ev.item} ${'refId' in ev ? ev.refId : ''}`} fish ${e(st.fishSps)}/s fare ${e(st.fareSps)}/s cars ${s.carriages.length} fish# ${Object.keys(s.fish).length}`);
      } else if (ev.type === 'terminalReached' || ev.type === 'lineOpened') {
        lines.push(`${m(t)} ${ev.type} L${ev.line} runShells ${e(s.runShells)} proj ${sim.projectedTickets()}`);
      } else if (ev.type === 'depotReset') {
        lines.push(`${m(t)} RESET after ${m(t - runStart)} min: +${ev.tickets} total ${ev.totalTicketsEarned} → L${ev.line} mascot ${ev.mascotSpecies}`);
        runStart = t;
      } else if (ev.type === 'upgradeBought') {
        lines.push(`${m(t)} upgrade ${ev.id}`);
      } else if (ev.type === 'ending') { lines.push(`${m(t)} ENDING`); end = true; }
    }
    if (end) break;
  }
  const L = sim.state.lifetime;
  console.log(`=== ${bot} seed ${seed}: ${m(t)} min, resets ${sim.state.permanent.resets}, fare ${(L.fareShells / L.shellsEarned * 100).toFixed(1)}% req ${(L.requestShells / L.shellsEarned * 100).toFixed(1)}% dead ${dead}s @${m(deadAt)}`);
  for (const l of lines) console.log('  ' + l);
}
