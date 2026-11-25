// Dev-only UI harness (served by `vite` at /src/ui/harness/index.html): a fake GameApi over a real sim.
// Query: ?preset=new|mid|late  &panel=market|track|stamps|depot|settings|car  &tab=fish|decor|special|requests|catalogue
//        &title=1  &offline=1  &modal=reset|postcard
//        &depot0=1 (reset rules met but 0 projected Tickets)  &toasts=3 (stamp toasts)  &ending=1 (endless toast)
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import '../hud.css';
import { loadGameData } from '../../data/schema';
import { createSim, type StoryData } from '../../sim';
import requestsJson from '../../story/requests.json';
import { Bus, DEFAULT_SETTINGS, type Settings } from '../../game/bus';
import { defaultTargetCar } from '../helpers';
import { mountUI } from '../index';
import { openMarketTab } from '../market';
import { showPostcard } from '../modal';
import type { GameApi } from '../types';

const q = new URLSearchParams(location.search);
const data = loadGameData();
const story = requestsJson as unknown as StoryData;
const sim = createSim(data, { seed: 7, story });
const bus = new Bus();
let settings: Settings = { ...DEFAULT_SETTINGS };
let selected: string | null = null;
let paused = false;

function grow(rounds: number, line: number): void {
  for (let i = 0; i < rounds; i++) {
    const s = sim.state;
    s.shells += 50 * Math.pow(4.2, i) * (line > 1 ? 1e5 : 1);
    sim.act({ type: 'buildTrack' });
    if (s.carriages.length < 2 + i / 2) sim.act({ type: 'buyCarriage', habitat: i % 2 ? 'mangrove' : 'reef' });
    for (const sp of s.market.fish) {
      const car = defaultTargetCar(s, data, sp);
      if (car) sim.act({ type: 'buyFish', species: sp, carId: car });
    }
    for (const d of s.market.decor.slice(0, 1)) sim.act({ type: 'buyDecor', decorId: d });
    for (const f of Object.values(s.fish)) sim.act({ type: 'levelFish', fishId: f.id, times: 5 });
    sim.advance(57);
  }
  sim.drainEvents();
}

const preset = q.get('preset') ?? 'mid';
if (preset === 'mid') grow(8, 1);
if (preset === 'late') {
  grow(12, 1);
  const s = sim.state;
  s.shells += 5e6;
  s.runShells += 5e6;
  s.terminalReachedThisRun = true;
  s.permanent.tickets = 7;
  s.permanent.totalTicketsEarned = 9;
  s.permanent.openedLines = [1, 2];
  s.permanent.upgrades = ['season_pass'];
  s.fish[Object.keys(s.fish)[0]].shiny = true;
  s.permanent.stamps.push('shiny:pebble_damsel', 'species:garibaldi');
  s.permanent.resets = 1;
}
if (q.get('depot0')) {
  const s = sim.state;
  s.runShells = data.config.depotReset.minRunShells;
  s.terminalReachedThisRun = true;
}
sim.drainEvents();

const api: GameApi = {
  sim,
  data,
  story,
  act: (a) => sim.act(a),
  price: (a) => sim.price(a),
  on: (t, cb) => bus.on(t, cb),
  getSettings: () => settings,
  setSettings: (p) => {
    settings = { ...settings, ...p };
    bus.emit('settings', settings);
  },
  selectCar: (id) => (selected = id),
  selectedCar: () => selected,
  enterTankView: (id) => bus.emit('tankView', { carId: id }),
  exitTankView: () => bus.emit('tankView', { carId: null }),
  emitUi: (t, p) => console.info('[ui]', t, p),
  hasSave: () => preset !== 'new',
  offlineReport: () => (q.get('offline') ? { seconds: 2 * 3600 + 14 * 60, shells: 48210, stationsVisited: 37 } : null),
  newGame: () => location.reload(),
  setPaused: (p) => (paused = p),
};

const app = document.getElementById('app') ?? document.body;
app.style.background = 'linear-gradient(#bfe6f2, #8fd3e8 55%, #3cc7c4 56%)';
if (q.get('tab')) openMarketTab(q.get('tab') ?? 'fish');
const ui = mountUI(app, api, { title: q.get('title') === '1' });
const panel = q.get('panel');
if (panel) ui.open(panel as Parameters<typeof ui.open>[0], q.get('car') ?? undefined);
if (q.get('modal') === 'postcard') showPostcard('l1s3');
if (q.get('modal') === 'reset') setTimeout(() => document.querySelector<HTMLButtonElement>('.ui-panel .ui-brass.big')?.click(), 50);
const nToasts = Number(q.get('toasts') ?? 0);
const toastSpecies = ['clownfish', 'carpet_anemone', 'pebble_damsel', 'garibaldi'];
for (let i = 0; i < nToasts; i++) {
  const ref = toastSpecies[i % toastSpecies.length] ?? 'clownfish';
  bus.emitSim({ type: 'stamp', stampId: `species:${ref}`, kind: 'species', ref });
}
if (q.get('ending')) bus.emitSim({ type: 'ending', line: 3 });

let last = performance.now();
const loop = (now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) sim.advance(dt);
  for (const e of sim.drainEvents()) bus.emitSim(e);
  bus.emit('frame', { dt });
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
(window as unknown as { __ui: unknown }).__ui = { ui, sim, bus };
