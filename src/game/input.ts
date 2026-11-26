import type { Stage } from '../render/stage';
import type { GameApiImpl } from './api';
import type { GameController } from './controller';

const LONG_PRESS_MS = 500;
const DOUBLE_TAP_MS = 320;
const DRAG_PX = 8;

/**
 * Canvas + keyboard input for the train view (B8): tap car = feed, long-press /
 * right-click = car detail, double-tap = Tank View, drag = pan, drag a fish onto
 * another carriage = moveFish, tap Sights. Keys: ←/→, 1–8, Space, Enter.
 */
export function attachInput(canvas: HTMLCanvasElement, stage: Stage, game: GameController, api: GameApiImpl): () => void {
  let down: { x: number; y: number; id: number; pick: ReturnType<Stage['pick']>; moved: boolean; consumed: boolean; mode: 'none' | 'pan' | 'fish' } | null = null;
  let lastX = 0;
  let longTimer = 0;
  let lastTap = { carId: '', at: 0 };
  const ndc = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
  };
  const inTank = () => document.body.classList.contains('ui-tank');
  const openDetail = (carId: string) => {
    api.selectCar(carId);
    game.bus.emit('carDetail', { carId });
  };

  const onDown = (e: PointerEvent) => {
    if (inTank() || e.button === 2) return;
    const p = ndc(e);
    const pick = stage.pick(p.x, p.y);
    if (pick?.kind === 'sight') {
      api.act({ type: 'tapSight' });
      return;
    }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, pick, moved: false, consumed: false, mode: 'none' };
    lastX = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
    clearTimeout(longTimer);
    if (pick) {
      longTimer = window.setTimeout(() => {
        if (down && !down.moved && pick) {
          down.consumed = true;
          openDetail(pick.carId);
        }
      }, LONG_PRESS_MS);
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_PX) {
      down.moved = true;
      clearTimeout(longTimer);
      down.mode = down.pick?.kind === 'fish' ? 'fish' : 'pan';
    }
    if (down.mode === 'pan') {
      stage.rig.addPan(-(e.clientX - lastX) * 0.02 * (22 / Math.max(8, window.innerWidth / 60)));
    } else if (down.mode === 'fish' && down.pick?.kind === 'fish') {
      const f = game.sim.state.fish[down.pick.fishId];
      if (f) stage.dragGhost(f.species, f.shiny, ndc(e));
    }
    lastX = e.clientX;
  };

  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    clearTimeout(longTimer);
    const d = down;
    down = null;
    if (d.mode === 'fish' && d.pick?.kind === 'fish') {
      stage.dragGhost(null, false, null);
      const p = ndc(e);
      const target = stage.pick(p.x, p.y);
      if (target && target.kind !== 'sight' && target.carId !== d.pick.carId) {
        const r = api.act({ type: 'moveFish', fishId: d.pick.fishId, carId: target.carId });
        if (!r.ok) console.info(`[input] moveFish: ${r.reason}`);
      }
      return;
    }
    if (d.moved || d.consumed || !d.pick || d.pick.kind === 'sight') return;
    // T-40: a tap on the missing-partner hint shows its tooltip (GhostTip) and does not feed the car
    if (stage.bonds.isGhostAt(e.clientX, e.clientY)) return;
    const carId = d.pick.carId;
    const now = performance.now();
    if (lastTap.carId === carId && now - lastTap.at < DOUBLE_TAP_MS) {
      lastTap = { carId: '', at: 0 };
      api.selectCar(carId);
      api.enterTankView(carId);
      return;
    }
    lastTap = { carId, at: now };
    api.selectCar(carId);
    api.act({ type: 'feed', carId });
  };

  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    if (inTank()) return;
    const p = ndc(e);
    const pick = stage.pick(p.x, p.y);
    if (pick && pick.kind !== 'sight') openDetail(pick.carId);
  };

  const onWheel = (e: WheelEvent) => {
    if (inTank()) return;
    stage.rig.addPan((e.deltaX || e.deltaY) * 0.01);
  };

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || inTank()) return;
    if (document.querySelector('.ui-title, .ui-modal')) return;
    const cars = game.sim.state.carriages;
    const sel = api.selectedCar();
    const idx = sel ? cars.findIndex((c) => c.id === sel) : -1;
    if (e.key === 'ArrowLeft') {
      // train faces right: left = towards the rear
      const c = cars[Math.min(cars.length - 1, idx + 1)];
      if (c) api.selectCar(c.id);
    } else if (e.key === 'ArrowRight') {
      const c = idx <= 0 ? null : cars[idx - 1];
      api.selectCar(c ? c.id : null);
    } else if (/^[1-8]$/.test(e.key)) {
      const c = cars[Number(e.key) - 1];
      if (c) api.selectCar(c.id);
    } else if (e.key === ' ') {
      e.preventDefault();
      let best: { id: string; inc: number } | null = null;
      for (const c of cars) {
        const info = game.sim.carInfo(c.id);
        if (info.frenzyReadyIn > 0 || info.frenzyActive) continue;
        if (!best || info.income > best.inc) best = { id: c.id, inc: info.income };
      }
      if (best) api.act({ type: 'feed', carId: best.id });
    } else if (e.key === 'Enter') {
      const id = sel ?? cars[0]?.id;
      if (id) api.enterTankView(id);
    } else return;
  };

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', onContext);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('keydown', onKey);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('contextmenu', onContext);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey);
  };
}
