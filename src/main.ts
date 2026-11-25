import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import * as THREE from 'three';
import { GameController, type GameView } from './game/controller';
import { createApi } from './game/api';
import { createDebug } from './game/debug';
import { attachInput } from './game/input';
import { readSave } from './game/storage';
import { Stage } from './render/stage';
import { createTankView } from './render/tank/tankView';
import type { TankView } from './render/tank/types';
import { mountUI } from './ui';
import type { Quality } from './render/post/post';
import { createAudio } from './audio';
import { runEnding } from './ui/ending/ending';
import { playCinematic, playLineSplash } from './ui/video/cinematic';
import { bootUrls, hideLoading, runLoading } from './game/loading';

const params = new URLSearchParams(location.search);
const qParam = params.get('quality');
const seedParam = params.get('seed');
/** ?warp=N pre-advances the sim N seconds (handy for screenshots). */
const warp = Math.max(0, Number(params.get('warp') ?? 0) || 0);

async function boot(): Promise<void> {
  if (params.get('debug') === 'zoo') {
    // every species, plant and Sight in a grid (T-15)
    hideLoading();
    (await import('./render/tank/zoo')).mountZoo(document.body);
    return;
  }
  const app = document.getElementById('app') ?? document.body;
  const canvas = document.createElement('canvas');
  canvas.className = 'stage';
  app.appendChild(canvas);

  const fresh = params.get('new') === '1';
  const hadSave = !fresh && readSave() !== null;
  const game = new GameController({
    fresh,
    noSave: params.get('nosave') === '1',
    ...(seedParam ? { seed: Number(seedParam) >>> 0 } : {}),
  });
  // loading screen: preload only the current Line's scenery (others load lazily on first visit)
  const st0 = game.sim.state;
  const region = game.data.lines.find((l) => l.id === st0.currentLine)?.region;
  const loaded = runLoading(bootUrls(st0.currentLine, [...new Set(st0.carriages.map((c) => c.habitat))]), { region: region ? `The ${region}` : undefined });
  const settingsQuality = qParam === 'high' || qParam === 'low' ? qParam : 'auto';
  const stage = new Stage(canvas, game, { quality: settingsQuality as Quality | 'auto' });

  // Tank View (T-15) draws on top of the train view.
  let tank: TankView | null = null;
  const carRect = (carId: string) => {
    const c = stage.train.car(carId);
    if (!c) return null;
    const r = canvas.getBoundingClientRect();
    const toScreen = (x: number, y: number) => {
      const v = c.fishLayer.localToWorld(new THREE.Vector3(x, y, 0)).project(stage.rig.camera);
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    };
    const a = toScreen(-c.winW / 2, c.winH / 2);
    const b = toScreen(c.winW / 2, -c.winH / 2);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  };
  try {
    tank = createTankView({
      renderer: stage.renderer,
      api: { data: game.data, state: () => game.sim.state, act: (a) => game.sim.act(a), carInfo: (id) => game.sim.carInfo(id) },
      host: app,
      getCarScreenRect: carRect,
      onExit: () => game.bus.emit('tankView', { carId: null }),
    });
  } catch (err) {
    console.warn('[main] Tank View unavailable', err);
  }

  const view: GameView = {
    handle(e, bulk) {
      stage.handle(e, bulk);
      if (!bulk && tank?.isActive()) tank.onEvent(e);
    },
    frame(dt, realDt) {
      stage.skipRender = !!tank?.isCovering();
      stage.frame(dt, realDt);
      if (tank?.isActive()) {
        tank.update(dt);
        tank.render();
      }
    },
  };
  game.view = view;

  const api = createApi(
    game,
    {
      enterTankView(carId) {
        if (!tank || tank.isActive()) return;
        tank.enter(carId);
        game.bus.emit('tankView', { carId });
      },
      exitTankView() {
        tank?.exit();
      },
      onSelect(carId) {
        stage.selectedCarId = carId;
      },
      onSettings(s) {
        if (qParam !== 'high' && qParam !== 'low') stage.setQuality(s.quality);
      },
    },
    hadSave,
  );
  if (qParam !== 'high' && qParam !== 'low') stage.setQuality(api.getSettings().quality);

  const debug = createDebug(game, {
    setTimeOfDay: (t) => (stage.timeOverride = t),
    openPanel: (id) => game.bus.emit('openPanel', { id }),
  });
  api.debug = debug;
  const w = window as unknown as { __debug?: Record<string, unknown> };
  w.__debug = Object.assign(w.__debug ?? {}, debug, {
    stage,
    api,
    tank,
    setQuality: (q: Quality) => stage.setQuality(q),
  });

  // UI → render: a bought item flies into its carriage (uiSound has no audio module yet)
  const onAny = game.bus.on as unknown as (t: string, cb: (e: { carId?: string; kind?: string }) => void) => () => void;
  onAny.call(game.bus, 'itemFly', (e) => e.carId && stage.itemFly(e.carId));

  // ---- audio + cinematics (T-18) ----
  const lowQ = () => api.getSettings().quality === 'low' || (stage.quality === 'auto' && stage.post.quality === 'low');
  let ending = false;
  const audio = createAudio(game.bus, () => api.getSettings(), { getLine: () => game.sim.state.currentLine });
  const dbg = w.__debug ?? {};
  dbg.audio = audio;
  // Depot theme while the Depot panel is open (the HUD has no panel events: poll its state twice a second)
  let depotOpen = false;
  let poll = 0;
  game.bus.on('frame', (e) => {
    audio.setTrainSpeed(stage.trainSpeed);
    poll += e.dt;
    if (poll < 0.5) return;
    poll = 0;
    const open = !!app.querySelector('.hud-btn.on[data-id="depot"]');
    if (open === depotOpen || ending) return;
    depotOpen = open;
    if (open) audio.setScene({ kind: 'depot' });
    else audio.backToLine(game.sim.state.currentLine);
  });
  // one splash at a time: a batch that opens several Lines (offline / debug) shows only the latest
  let splashTimer: ReturnType<typeof setTimeout> | undefined;
  let curSplash: { stop(): void } | null = null;
  const splash = (line: number) => {
    clearTimeout(splashTimer);
    splashTimer = setTimeout(() => {
      curSplash?.stop();
      const l = game.data.lines.find((x) => x.id === line);
      curSplash = playLineSplash(document.body, line, { lineName: l?.name ?? `Line ${line}`, region: l?.region, lowQuality: lowQ(), onEnd: () => (curSplash = null) });
    }, 60);
  };
  game.bus.on('lineOpened', (e) => splash(e.line));
  // depot scene → new run on the chosen Line
  stage.onRunStart = (line) => {
    game.bus.emit('runStart', { line });
    splash(line);
  };
  game.bus.on('ending', () => {
    if (ending) return;
    ending = true;
    api.setPaused?.(true);
    dbg.ending = runEnding({
      container: document.body,
      api,
      audio,
      renderer: stage.renderer,
      lowQuality: lowQ(),
      onDone: () => {
        ending = false;
        api.setPaused?.(false);
        audio.exitEnding(game.sim.state.currentLine);
      },
    });
  });

  attachInput(canvas, stage, game, api);
  if (warp > 0) game.fastForward(warp);
  mountUI(app, api, { title: params.get('title') !== '0' });
  // title-screen background loop behind T-14's title menu
  const titleEl = app.querySelector<HTMLElement>('.ui-title');
  if (titleEl) {
    const cine = playCinematic(titleEl, 'title_loop', { loop: true, lowQuality: lowQ() });
    const art = titleEl.querySelector('.ui-title-art');
    if (art) art.after(cine.el);
    const off = game.bus.on('frame', () => {
      if (titleEl.isConnected && !titleEl.classList.contains('out')) return;
      off();
      setTimeout(() => cine.stop(), 500);
    });
  }
  game.start();
  await loaded;
}

void boot();
