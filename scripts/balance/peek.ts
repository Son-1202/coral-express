// Debug: play greedy to minute T, then print the top candidates by score.
import { loadGameData } from '../../src/data/schema';
import { createSim, type StoryData } from '../../src/sim';
import requestsJson from '../../src/story/requests.json';
import { createBot, runBotSecond } from '../../src/bots';
import { buildIndex } from '../../src/sim/lookup';
import { snapshot } from '../../src/bots/econ';
import { structuralCandidates } from '../../src/bots/candidates';
import { botRng } from '../../src/bots/rng';
const T = Number(process.argv[2] ?? 600);
const seed = Number(process.argv[3] ?? 1);
const data = loadGameData();
const story = requestsJson as StoryData;
const sim = createSim(data, { seed, story });
const bot = createBot((process.argv[4] ?? 'greedy') as 'greedy', { data, story, seed });
for (let t = 0; t < T; t++) { runBotSecond(sim, bot, t); sim.drainEvents(); }
const idx = buildIndex(data, story);
const e = snapshot(idx, sim.state, 1.67);
const c = structuralCandidates(e, { bonds: true, rng: botRng(1) });
const sc = c.map((x) => ({ k: x.kind, a: JSON.stringify(x.actions).slice(0, 90), cost: x.cost, now: x.now, gain: x.gain, bonus: x.bonus,
  T: Math.max(0, x.now - sim.state.shells) / e.income + (x.cost - x.bonus) / x.gain })).sort((a, b) => a.T - b.T);
console.log(`shells ${sim.state.shells.toExponential(2)} income ${e.income.toExponential(2)} builtTo ${sim.state.builtTo}`);
for (const x of sc.slice(0, 12)) console.log(x.T.toFixed(0).padStart(7), x.k.padEnd(8), x.cost.toExponential(2), x.gain.toExponential(2), x.a);
for (const car of sim.state.carriages) {
  const info = sim.carInfo(car.id);
  console.log(car.id, car.habitat, 'appeal', info.appeal.toFixed(0), info.fish.map((f) => `${f.species}:L${sim.state.fish[f.fishId]!.level}:${f.sps.toExponential(1)}`).join(' '));
}
console.log('market', sim.state.market.stationId, sim.state.market.fish.join(','), 'bought', sim.state.speciesBoughtThisRun.join(','));
console.log('decide', JSON.stringify(bot.decide(sim, T)).slice(0, 300));
for (const car of sim.state.carriages) console.log('bonds', car.id, JSON.stringify(sim.carInfo(car.id).activeBonds).slice(0, 200));
