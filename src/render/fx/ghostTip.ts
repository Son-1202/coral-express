/**
 * T-27: small DOM tooltip for the missing-partner ghost ("Add a Watchman Goby to bond with …").
 * Shown while the pointer hovers a ghost, or for a few seconds after a tap on one (phone).
 */
export interface TipTarget {
  /** Screen rect (CSS px) of the ghost + its hint bubble. */
  rect: { x: number; y: number; w: number; h: number };
  text: string;
}

const TAP_SHOW_MS = 3200;

export class GhostTip {
  private el: HTMLDivElement | null = null;
  private tapUntil = 0;
  private hoverKey = '';

  /** `find(x, y)` returns the ghost under a CSS-pixel point, or null. */
  constructor(private readonly find: (x: number, y: number) => TipTarget | null) {
    if (typeof window === 'undefined') return;
    window.addEventListener('pointermove', (e) => this.onPointer(e, false), { passive: true });
    window.addEventListener('pointerdown', (e) => this.onPointer(e, true), { passive: true });
  }

  private onPointer(e: PointerEvent, tap: boolean): void {
    const onStage = e.target instanceof HTMLCanvasElement && e.target.classList.contains('stage');
    const hit = onStage && !document.body.classList.contains('ui-tank') ? this.find(e.clientX, e.clientY) : null;
    if (hit) {
      if (tap || e.pointerType !== 'mouse') this.tapUntil = performance.now() + TAP_SHOW_MS;
      this.show(hit);
    } else if (tap || performance.now() > this.tapUntil) this.hide();
  }

  private ensure(): HTMLDivElement {
    if (this.el) return this.el;
    const e = document.createElement('div');
    e.className = 'bond-ghost-tip';
    e.setAttribute('role', 'tooltip');
    e.style.cssText =
      'position:fixed;z-index:3;pointer-events:none;max-width:min(280px,calc(100vw - 24px));padding:4px 10px;' +
      'background:#fbf1d6;color:#2f4a52;border:2px solid #d9ac4c;border-radius:10px;box-shadow:0 3px 0 rgba(80,60,30,.25);' +
      'font:600 13px/17px "Pixelify Sans",sans-serif;font-variant-ligatures:none;text-align:center;opacity:0;transition:opacity .2s;';
    document.body.append(e);
    this.el = e;
    return e;
  }

  private show(t: TipTarget): void {
    const e = this.ensure();
    const key = `${t.text}`;
    if (key !== this.hoverKey) {
      e.textContent = t.text;
      this.hoverKey = key;
    }
    const w = e.offsetWidth || 240;
    const h = e.offsetHeight || 30;
    const cx = t.rect.x + t.rect.w / 2;
    const x = Math.max(12, Math.min(window.innerWidth - w - 12, cx - w / 2));
    let y = t.rect.y - h - 8;
    if (y < 8) y = t.rect.y + t.rect.h + 8;
    e.style.left = `${Math.round(x)}px`;
    e.style.top = `${Math.round(y)}px`;
    e.style.opacity = '1';
  }

  hide(): void {
    if (this.el) this.el.style.opacity = '0';
  }

  /** Tap tooltips expire on their own, and when Tank View opens (called per frame). */
  tick(): void {
    if (this.tapUntil && (performance.now() > this.tapUntil || document.body.classList.contains('ui-tank'))) {
      this.tapUntil = 0;
      this.hide();
    }
  }
}
