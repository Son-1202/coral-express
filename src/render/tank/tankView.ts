/**
 * Tank View (SPEC B4.15): full-screen view of one carriage's tank, drawn on top of the train view.
 * Enter = 0.8 s dolly from the carriage's on-screen rect to full screen (reverse on exit).
 * Modes: watch (follow fish, info card, food), decorate (tray + gestures), photo (frames, PNG, pin).
 */
import type { SimEvent } from '../../sim/types';
import { TankHud, type TankMode } from '../../ui/tank/tankHud';
import { TankScene, type Rect } from './scene';
import { DecorateInput } from './decorate';
import { buildCard, buildDock, saveNickname } from './models';
import { composePhoto, downloadPng, drawFrame, pinPostcard, preloadFrames, type FrameId } from './photo';
import { TANK } from './layout';
import type { TankView, TankViewCtx } from './types';

const DOLLY_S = 0.8;
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function createTankView(ctx: TankViewCtx): TankView {
  const { renderer, api } = ctx;
  const scene = new TankScene({ data: api.data, state: () => api.state() });
  let active = false;
  let carId: string | null = null;
  let mode: TankMode = 'watch';
  let frame: FrameId = 2;
  /** 0 = at the carriage, 1 = full screen. */
  let dolly = 0;
  let dir: 1 | -1 = 1;
  let fromRect: Rect | null = null;
  let trainSpeed = 0;
  let lastPhase = '';
  let cardTimer = 0;
  const pointers = new Map<number, { x: number; y: number; t: number; sx: number; sy: number }>();
  let pinch0 = 0;

  const fullRect = (): Rect => {
    const s = renderer.domElement.getBoundingClientRect();
    return { x: 0, y: 0, w: Math.max(1, s.width || window.innerWidth), h: Math.max(1, s.height || window.innerHeight) };
  };
  const startRect = (): Rect => {
    const r = carId ? ctx.getCarScreenRect?.(carId) : null;
    if (r && r.w > 4 && r.h > 4) return r;
    const f = fullRect();
    return { x: f.w * 0.27, y: f.h * 0.3, w: f.w * 0.46, h: f.h * 0.4 };
  };
  const currentRect = (): Rect => {
    const f = fullRect();
    const a = fromRect ?? f;
    const e = easeInOut(dolly);
    return { x: lerp(a.x, f.x, e), y: lerp(a.y, f.y, e), w: lerp(a.w, f.w, e), h: lerp(a.h, f.h, e) };
  };

  const hud = new TankHud(ctx.host ?? document.body, {
    onBack: () => view.exit(),
    onMode: (m) => setMode(m === mode && m !== 'watch' ? 'watch' : m),
    onNickname: (fishId, name) => {
      saveNickname(fishId, name);
      hud.toast(name ? `Renamed to ${name}` : 'Nickname cleared');
    },
    onTrayDown: (id, e) => {
      const img = (e.currentTarget as HTMLElement | null)?.querySelector('img');
      decorate.beginTrayDrag(id, img?.src ?? '', e);
    },
    onSwatch: (kind, value) => {
      if (!carId) return;
      const r = api.act({ type: 'setCosmetic', carId, kind, value });
      if (!r.ok) hud.toast(r.reason === 'locked' ? 'Locked — find it at a market' : `Can't (${r.reason})`);
    },
    onFrame: (n) => {
      frame = n;
      hud.setPhotoFrame(n);
      drawFramePreview();
    },
    onSavePhoto: () => {
      const shot = takePhoto();
      if (shot) downloadPng(shot, `coral-express-${carId ?? 'tank'}-${Date.now()}.png`);
    },
    onPinPhoto: () => {
      const shot = takePhoto();
      if (shot && carId) hud.toast(pinPostcard(shot, carId, frame) ? 'Pinned in your Stamp book' : 'Stamp book is full');
    },
  });
  const decorate = new DecorateInput(api, scene, currentRect, (t) => hud.toast(t));
  preloadFrames();

  function setMode(m: TankMode): void {
    mode = m;
    hud.setMode(m);
    if (m !== 'watch') scene.follow = null;
    if (m === 'photo') {
      hud.setPhotoFrame(frame);
      drawFramePreview();
    }
    refreshDock();
  }

  function refreshDock(): void {
    if (mode !== 'decorate' || !carId) return;
    const m = buildDock(api, carId);
    if (m) hud.setDock(m);
  }

  function takePhoto(): HTMLCanvasElement | null {
    const r = fullRect();
    const w = 1280;
    const h = Math.round((w * r.h) / r.w);
    try {
      return composePhoto(scene.capture(renderer, w, h), frame);
    } catch {
      hud.toast('Photo failed');
      return null;
    }
  }

  function drawFramePreview(): void {
    const c = hud.frameCanvas;
    const r = fullRect();
    c.width = Math.round(r.w);
    c.height = Math.round(r.h);
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, c.width, c.height);
    drawFrame(g, frame, c.width, c.height);
  }

  // ---------------- input ----------------
  const root = hud.root;
  const onTankSurface = (e: Event) => e.target === root || e.target === hud.frameCanvas;
  const pinchDist = (): number => {
    const ps = [...pointers.values()];
    return ps.length >= 2 ? Math.hypot((ps[0]?.x ?? 0) - (ps[1]?.x ?? 0), (ps[0]?.y ?? 0) - (ps[1]?.y ?? 0)) : 0;
  };
  root.addEventListener('pointerdown', (e) => {
    if (!onTankSurface(e) || dolly < 1) return;
    root.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (pointers.size === 2) pinch0 = pinchDist();
    if (mode === 'decorate') decorate.down(e, pointers.size);
  });
  root.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const d = pinchDist();
    if (mode === 'decorate') decorate.move(e, pointers.size >= 2 ? d : 0);
    else if (mode === 'watch' && pointers.size >= 2 && pinch0 > 0 && d / pinch0 < 0.6) {
      pointers.clear();
      view.exit(); // pinch-out leaves
    }
  });
  const up = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (mode === 'decorate') {
      if (pointers.size === 0) decorate.up();
      return;
    }
    if (mode !== 'watch' || pointers.size > 0 || e.type === 'pointercancel') return;
    const tap = Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 8 && performance.now() - p.t < 500;
    if (tap) watchTap(e.clientX, e.clientY);
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('wheel', (e) => {
    if (mode === 'decorate' && onTankSurface(e)) {
      e.preventDefault();
      decorate.wheel(e);
    }
  }, { passive: false });

  function watchTap(px: number, py: number): void {
    const w = scene.screenToWorld(px, py, currentRect());
    const id = scene.pickFish(w.x, w.y);
    if (id) {
      scene.follow = scene.follow === id ? null : id;
      showCard();
      return;
    }
    if (w.x > 0 && w.x < TANK.w && w.y > TANK.floor && w.y < TANK.surface) scene.dropFood(w.x, w.y);
  }

  function showCard(): void {
    const info = scene.follow && carId ? buildCard(api, carId, scene.follow) : null;
    hud.showCard(info);
  }

  const onKey = (e: KeyboardEvent) => {
    if (!active || (e.target instanceof HTMLInputElement)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (mode !== 'watch') setMode('watch');
      else if (scene.follow) (scene.follow = null), showCard();
      else view.exit();
    } else if (e.key === 'e' || e.key === 'E') setMode(mode === 'decorate' ? 'watch' : 'decorate');
    else if (e.key === 'p' || e.key === 'P') setMode(mode === 'photo' ? 'watch' : 'photo');
    else return;
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', onKey, true);
  const onResize = () => mode === 'photo' && drawFramePreview();
  window.addEventListener('resize', onResize);

  // ---------------- lifecycle ----------------
  const view: TankView = {
    get carId() {
      return carId;
    },
    enter(id) {
      if (active && carId === id && dir === 1) return;
      carId = id;
      scene.setCar(id);
      const car = scene.car();
      const idx = api.state().carriages.findIndex((c) => c.id === id);
      hud.setTitle(`Carriage ${idx + 1} · ${car ? car.habitat[0]?.toUpperCase() + car.habitat.slice(1) : ''}`, !!car?.heritage);
      active = true;
      dir = 1;
      if (dolly <= 0) fromRect = startRect();
      setMode('watch');
      hud.show(false);
      lastPhase = api.state().train.phase;
    },
    exit() {
      if (!active) return;
      dir = -1;
      fromRect = startRect();
      hud.show(false);
      scene.follow = null;
      hud.showCard(null);
    },
    update(dt) {
      if (!active) return;
      dolly = Math.min(1, Math.max(0, dolly + (dir * dt) / DOLLY_S));
      if (dir === 1 && dolly >= 1) hud.show(true);
      if (dir === -1 && dolly <= 0) {
        active = false;
        hud.show(false);
        ctx.onExit?.();
        return;
      }
      const st = api.state();
      // slosh on brake (arrive) / pull-away (depart): read from train phase so it works without events
      const phase = st.train.phase;
      if (lastPhase && phase !== lastPhase) scene.slosh.impulse((phase === 'stopped' ? 2 : -2) * st.train.dir);
      lastPhase = phase;
      trainSpeed += ((phase === 'moving' ? 1 : 0) - trainSpeed) * (1 - Math.exp(-1.5 * dt));
      scene.update(dt, trainSpeed);
      if (!scene.car()) return view.exit();
      cardTimer -= dt;
      if (cardTimer <= 0) {
        cardTimer = 0.5;
        if (scene.follow && carId) {
          const info = buildCard(api, carId, scene.follow);
          if (info) hud.refreshCard(info);
          else (scene.follow = null), hud.showCard(null);
        }
        refreshDock();
      }
    },
    render() {
      if (!active) return;
      scene.render(renderer, currentRect());
    },
    isActive: () => active,
    isCovering: () => active && dolly >= 1,
    onEvent(e: SimEvent) {
      if (!active) return;
      if (e.type === 'levelUp' || e.type === 'milestone') {
        const f = scene.fish.get(e.fishId);
        if (f) f.flash = 1;
      } else if (e.type === 'frenzy' && e.carId === carId) {
        for (const f of scene.fish.values()) f.mover.kick();
      }
    },
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      decorate.dispose();
      hud.dispose();
      scene.dispose();
    },
  };
  return view;
}
