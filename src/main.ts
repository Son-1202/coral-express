import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import { Stage } from './render/stage';
import { PLACEHOLDER } from './render/placeholder';
import { Hud, mountRotateCard } from './ui/hud';
import type { Quality } from './render/post/post';

const params = new URLSearchParams(location.search);
const fast = params.get('fast') === '1';
const qParam = params.get('quality');
const quality: Quality | 'auto' = qParam === 'high' || qParam === 'low' ? qParam : 'auto';
/** ?warp=N pre-advances the animation N seconds (handy for screenshots). */
const warp = Math.max(0, Number(params.get('warp') ?? 0) || 0);

function boot(): void {
  const app = document.getElementById('app') ?? document.body;
  const canvas = document.createElement('canvas');
  canvas.className = 'stage';
  app.appendChild(canvas);

  const stage = new Stage(canvas, {
    legSeconds: fast ? PLACEHOLDER.fastLegSeconds : PLACEHOLDER.legSeconds,
    stopSeconds: PLACEHOLDER.stopSeconds,
    quality,
  });
  for (let t = 0; t < warp; t += 1 / 30) stage.step(1 / 30);

  const hud = new Hud(app, (id) => console.info(`[hud] ${id} panel (coming soon)`));
  mountRotateCard(app);

  // drag / wheel to pan the camera
  let dragX: number | null = null;
  canvas.addEventListener('pointerdown', (e) => (dragX = e.clientX));
  window.addEventListener('pointerup', () => (dragX = null));
  window.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    stage.rig.addPan(-(e.clientX - dragX) * 0.02);
    dragX = e.clientX;
  });
  canvas.addEventListener('wheel', (e) => stage.rig.addPan((e.deltaX || e.deltaY) * 0.01), { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') stage.follow = Math.min(stage.train.parts.length - 1, stage.follow + 1);
    if (e.key === 'ArrowRight') stage.follow = Math.max(0, stage.follow - 1);
  });

  let shells: number = PLACEHOLDER.demoShells;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    stage.frame(dt);
    shells += PLACEHOLDER.demoShellsPerSec * dt;
    const m = stage.motion;
    hud.update({
      shells,
      shellsPerSec: PLACEHOLDER.demoShellsPerSec,
      tickets: 0,
      progress: m.legProgress,
      eta: m.eta,
      stationLabel: m.phase === 'stopped' ? `At station ${m.station + 1}` : `Next: station ${m.station + 2}`,
    });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const w = window as unknown as { __debug?: Record<string, unknown> };
  w.__debug = {
    ...(w.__debug ?? {}),
    stage,
    setTimeOfDay: (t: number | 'morning' | 'afternoon' | 'dusk' | 'night') => {
      const map = { morning: 0, afternoon: 0.25, dusk: 0.5, night: 0.75 } as const;
      stage.post.setTimeOfDay(typeof t === 'number' ? t : map[t]);
    },
    setQuality: (q: Quality) => stage.post.setQuality(q),
  };
}

boot();
