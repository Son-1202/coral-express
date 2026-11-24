/**
 * Dev entry for /src/render/tank/zoo.html (Vite dev server only).
 *   ?view=zoo (default) [&paused=1]         → mountZoo
 *   ?view=tank&mode=watch|decorate|photo   → Tank View over a demo game (for QA screenshots)
 * `window.__zoo` / `window.__tank` expose handles for scripted capture.
 */
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import * as THREE from 'three';
import { mountZoo } from './zoo';
import { createTankView } from './tankView';
import { demoApi } from './demo';

const q = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;
document.body.style.margin = '0';
document.body.style.background = '#17303a';

if (q.get('view') === 'tank') {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;';
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight, false));
  const api = demoApi();
  const car = api.state().carriages[0]?.id ?? 'c1';
  const view = createTankView({ renderer, api });
  w.__tank = view;
  view.enter(car);
  const mode = q.get('mode');
  if (mode === 'decorate') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
  if (mode === 'photo') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    renderer.setClearColor('#2b3f63');
    renderer.clear();
    view.update(dt);
    view.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else {
  const zoo = mountZoo(document.body);
  if (q.get('paused') === '1') zoo.setPaused(true);
  w.__zoo = zoo;
}
