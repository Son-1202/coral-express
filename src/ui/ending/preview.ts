/**
 * Dev page: /src/ui/ending/preview.html — runs the Grand Terminus ending with a fake owned-species
 * list and the real audio module on a local bus.
 * Query: ?n=<species count> (default 12) · ?low=1 (Low quality) · ?auto=1 (start without a click)
 *        · ?beat=<id>&u=<0..1> (jump, for screenshots) · ?cars=<1..8> beach carriages (default 3).
 * `window.__ending` exposes the handle.
 */
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import '../hud.css';
import { loadGameData } from '../../data/schema';
import { Bus, DEFAULT_SETTINGS } from '../../game/bus';
import { createAudio } from '../../audio';
import { runEnding, type EndingHandle } from './ending';
import type { BeatId } from './timeline';

const q = new URLSearchParams(location.search);
const n = Number(q.get('n') ?? 12);
const low = q.get('low') === '1';
const fish = loadGameData().species.slice(0, n).map((s, i) => ({ species: s.id, motion: s.motion, shiny: i % 5 === 4 }));
const HABITATS = ['reef', 'kelp', 'mangrove', 'polar', 'vent'];
const carCount = Math.max(1, Math.min(8, Number(q.get('cars') ?? 3)));
// fake carriages: habitats cycle, each holds 2–4 of the cast
const cars = Array.from({ length: carCount }, (_, i) => ({
  habitat: HABITATS[i % HABITATS.length] ?? 'reef',
  fish: fish.filter((f) => f.motion !== 'swarm').slice(i * 2, i * 2 + 2 + (i % 3)),
}));
const bus = new Bus();
const audio = createAudio(bus, () => DEFAULT_SETTINGS, { getLine: () => 3 });
const app = document.getElementById('app') as HTMLElement;
const w = window as unknown as { __ending?: EndingHandle; __endingDone?: boolean; __audio?: typeof audio };
w.__audio = audio;

const btn = document.createElement('button');
btn.textContent = 'Start the Grand Terminus ending';
btn.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font:20px var(--font-head);padding:12px 22px;border-radius:10px;border:3px solid #d9ac4c;background:#fbf1d6;color:#2f4a4a;cursor:pointer';
app.append(btn);

function start(): void {
  btn.remove();
  audio.unlock();
  w.__endingDone = false;
  const h = runEnding({
    container: app,
    fish,
    cars,
    lowQuality: low,
    audio,
    onDone: () => {
      w.__endingDone = true;
      app.append(btn);
      btn.textContent = 'Ending done — play again';
    },
  });
  w.__ending = h;
  const beat = q.get('beat') as BeatId | null;
  if (beat) h.seek(beat, Number(q.get('u') ?? 0));
}

btn.addEventListener('click', start);
if (q.get('auto') === '1') start();
