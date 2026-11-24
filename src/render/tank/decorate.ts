/**
 * Decorate-mode gestures: drag from tray → place; drag placed item → move; wheel / pinch → scale
 * (0.8–1.2); tap → flip; long-press → remove. Every change goes through sim actions.
 */
import type { PlacedDecor, FailReason } from '../../sim/types';
import type { TankApi } from './types';
import type { Rect, TankScene } from './scene';
import type { DecorActor } from './actors';
import { clampScale, snapPlacement, TANK } from './layout';

const LONG_PRESS_MS = 600;
const TAP_PX = 6;

const REASONS: Partial<Record<FailReason, string>> = {
  noCapacity: 'No room left in this carriage',
  noCopy: 'None left in your tray',
  invalid: 'Cannot place it there',
};

export class DecorateInput {
  private drag: { actor: DecorActor; start: PlacedDecor; sx: number; sy: number; dx: number; dy: number; moved: boolean; t0: number } | null = null;
  private press: ReturnType<typeof setTimeout> | null = null;
  private pinch: { d0: number; s0: number } | null = null;
  private ghost: HTMLImageElement | null = null;

  constructor(
    private readonly api: TankApi,
    private readonly scene: TankScene,
    private readonly rect: () => Rect,
    private readonly toast: (t: string) => void,
  ) {}

  private act(a: Parameters<TankApi['act']>[0]): boolean {
    const r = this.api.act(a);
    if (!r.ok) this.toast(REASONS[r.reason] ?? `Can't do that (${r.reason})`);
    return r.ok;
  }

  private normAt(px: number, py: number): { x: number; y: number } {
    const w = this.scene.screenToWorld(px, py, this.rect());
    return { x: w.x / TANK.w, y: w.y / TANK.h };
  }

  private insideTank(px: number, py: number): boolean {
    const n = this.normAt(px, py);
    return n.x >= 0 && n.x <= 1 && n.y >= -0.05 && n.y <= 1;
  }

  /** Tray item pressed: drag a ghost icon; drop inside the tank places it. */
  beginTrayDrag(id: string, icon: string, e: PointerEvent): void {
    e.preventDefault();
    const g = document.createElement('img');
    g.className = 'tk-ghost';
    g.src = icon;
    g.style.left = `${e.clientX}px`;
    g.style.top = `${e.clientY}px`;
    document.body.appendChild(g);
    this.ghost = g;
    const move = (ev: PointerEvent) => {
      g.style.left = `${ev.clientX}px`;
      g.style.top = `${ev.clientY}px`;
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      g.remove();
      this.ghost = null;
      if (ev.type === 'pointercancel' || !this.insideTank(ev.clientX, ev.clientY)) return;
      const n = this.normAt(ev.clientX, ev.clientY);
      const s = snapPlacement(n.x, n.y);
      this.act({ type: 'placeDecor', carId: this.scene.carId, decorId: id, ...s, scale: 1, flip: false });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  down(e: PointerEvent, pointers: number): void {
    const w = this.scene.screenToWorld(e.clientX, e.clientY, this.rect());
    if (pointers === 2 && this.drag) {
      this.cancelPress();
      this.pinch = { d0: 0, s0: this.drag.actor.placed.scale };
      return;
    }
    const actor = this.scene.pickDecor(w.x, w.y);
    if (!actor) return;
    const p = actor.placed;
    this.drag = { actor, start: { ...p }, sx: e.clientX, sy: e.clientY, dx: p.x * TANK.w - w.x, dy: p.y * TANK.h - w.y, moved: false, t0: performance.now() };
    this.press = setTimeout(() => {
      if (this.drag && !this.drag.moved) {
        const idx = this.drag.actor.index;
        this.drag = null;
        this.scene.preview = null;
        if (this.act({ type: 'removeDecor', carId: this.scene.carId, index: idx })) this.toast('Back in the tray');
      }
    }, LONG_PRESS_MS);
  }

  /** `pinchDist` = current distance between two pointers (0 if not pinching). */
  move(e: PointerEvent, pinchDist: number): void {
    const d = this.drag;
    if (!d) return;
    if (this.pinch && pinchDist > 0) {
      if (!this.pinch.d0) this.pinch.d0 = pinchDist;
      const scale = clampScale(this.pinch.s0 * (pinchDist / this.pinch.d0));
      this.scene.preview = { index: d.actor.index, placed: { ...d.actor.placed, scale } };
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < TAP_PX) return;
    d.moved = true;
    this.cancelPress();
    const w = this.scene.screenToWorld(e.clientX, e.clientY, this.rect());
    const s = snapPlacement((w.x + d.dx) / TANK.w, (w.y + d.dy) / TANK.h);
    this.scene.preview = { index: d.actor.index, placed: { ...d.actor.placed, ...s } };
  }

  up(): void {
    this.cancelPress();
    const d = this.drag;
    const pv = this.scene.preview;
    this.drag = null;
    this.scene.preview = null;
    if (!d) return;
    const idx = d.actor.index;
    if (this.pinch) {
      this.pinch = null;
      if (pv) this.act({ type: 'moveDecor', carId: this.scene.carId, index: idx, scale: pv.placed.scale });
      return;
    }
    if (d.moved && pv) {
      const { x, y, layer } = pv.placed;
      if (!this.act({ type: 'moveDecor', carId: this.scene.carId, index: idx, x, y, layer })) this.restore(d.actor, d.start);
    } else if (!d.moved && performance.now() - d.t0 < LONG_PRESS_MS) {
      this.act({ type: 'moveDecor', carId: this.scene.carId, index: idx, flip: !d.start.flip });
    }
  }

  wheel(e: WheelEvent): void {
    const w = this.scene.screenToWorld(e.clientX, e.clientY, this.rect());
    const a = this.scene.pickDecor(w.x, w.y);
    if (!a) return;
    const scale = clampScale(a.placed.scale * (e.deltaY < 0 ? 1.05 : 1 / 1.05));
    if (Math.abs(scale - a.placed.scale) > 1e-4) this.act({ type: 'moveDecor', carId: this.scene.carId, index: a.index, scale });
  }

  private restore(actor: DecorActor, p: PlacedDecor): void {
    actor.placed = { ...p };
    actor.layout();
  }

  private cancelPress(): void {
    if (this.press) clearTimeout(this.press);
    this.press = null;
  }

  dispose(): void {
    this.cancelPress();
    this.ghost?.remove();
  }
}
