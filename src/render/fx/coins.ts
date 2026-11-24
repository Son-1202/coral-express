import * as THREE from 'three';

/** HUD targets the coins fly to (T-14 may tag its counter with data-hud="shells"). */
const TARGETS = ['[data-hud="shells"]', '.hud-stat.shells', '.hud-shells'];

const STYLE = `
.fx-coin{position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;
background:radial-gradient(circle at 35% 35%,#fff6c8 0 18%,#f4cf5a 20% 62%,#d9ac4c 64%);box-shadow:0 0 0 1px #9c7430;
pointer-events:none;z-index:40;will-change:transform,opacity;image-rendering:pixelated}
.fx-pop{position:fixed;left:0;top:0;pointer-events:none;z-index:41;font:700 15px "Silkscreen",monospace;color:#fff6d8;
text-shadow:0 1px 0 #6b4a1c,1px 0 0 #6b4a1c,-1px 0 0 #6b4a1c,0 -1px 0 #6b4a1c;white-space:nowrap;will-change:transform,opacity}
@keyframes fx-hud-bump{0%{transform:scale(1)}40%{transform:scale(1.12)}100%{transform:scale(1)}}
.fx-bump{animation:fx-hud-bump .35s ease-out}`;

let styled = false;
function ensureStyle(): void {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.appendChild(s);
}

interface Coin {
  el: HTMLElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  delay: number;
  arc: number;
  kind: 'coin' | 'pop';
}

/** DOM coins that burst from a world position and fly into the HUD Shells counter. */
export class CoinFlight {
  private readonly coins: Coin[] = [];
  private readonly v = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
  ) {
    ensureStyle();
  }

  private screen(p: THREE.Vector3): { x: number; y: number } {
    this.v.copy(p).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((this.v.x + 1) / 2) * r.width, y: r.top + ((1 - this.v.y) / 2) * r.height };
  }

  private target(): { x: number; y: number; el: Element | null } {
    for (const sel of TARGETS) {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) return { x: r.left + Math.min(28, r.width / 2), y: r.top + r.height / 2, el };
      }
    }
    return { x: window.innerWidth / 2, y: 24, el: null };
  }

  /** Coins from each world point to the HUD; plus a floating "+N" label at the first point. */
  fly(from: THREE.Vector3[], perPoint: number, label?: string): void {
    if (this.coins.length > 80) return;
    const t = this.target();
    from.forEach((p, i) => {
      const s = this.screen(p);
      for (let k = 0; k < perPoint; k++) {
        const el = document.createElement('div');
        el.className = 'fx-coin';
        document.body.appendChild(el);
        this.coins.push({
          el, x0: s.x + (Math.random() - 0.5) * 30, y0: s.y + (Math.random() - 0.5) * 16, x1: t.x, y1: t.y,
          t: 0, dur: 0.75 + Math.random() * 0.25, delay: i * 0.06 + k * 0.05, arc: 60 + Math.random() * 50, kind: 'coin',
        });
      }
    });
    const first = from[0];
    if (label && first) {
      const s = this.screen(first);
      const el = document.createElement('div');
      el.className = 'fx-pop';
      el.textContent = label;
      document.body.appendChild(el);
      this.coins.push({ el, x0: s.x, y0: s.y - 20, x1: s.x, y1: s.y - 70, t: 0, dur: 1.3, delay: 0, arc: 0, kind: 'pop' });
    }
    if (t.el) {
      const el = t.el as HTMLElement;
      setTimeout(() => {
        el.classList.remove('fx-bump');
        void el.offsetWidth;
        el.classList.add('fx-bump');
      }, 750);
    }
  }

  /** Floating text only (e.g. "+12" over a fish on level-up). */
  pop(at: THREE.Vector3, text: string): void {
    const s = this.screen(at);
    const el = document.createElement('div');
    el.className = 'fx-pop';
    el.textContent = text;
    document.body.appendChild(el);
    this.coins.push({ el, x0: s.x, y0: s.y - 10, x1: s.x, y1: s.y - 50, t: 0, dur: 1.1, delay: 0, arc: 0, kind: 'pop' });
  }

  update(dt: number): void {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (!c) continue;
      c.t += dt;
      const u = (c.t - c.delay) / c.dur;
      if (u < 0) {
        c.el.style.opacity = '0';
        continue;
      }
      if (u >= 1) {
        c.el.remove();
        this.coins.splice(i, 1);
        continue;
      }
      if (c.kind === 'coin') {
        const e = u * u * (3 - 2 * u);
        const x = c.x0 + (c.x1 - c.x0) * e;
        const y = c.y0 + (c.y1 - c.y0) * e - Math.sin(u * Math.PI) * c.arc;
        const s = 1 - u * 0.35;
        c.el.style.opacity = String(Math.min(1, u * 8));
        c.el.style.transform = `translate(${x}px,${y}px) scale(${s})`;
      } else {
        const e = 1 - (1 - u) * (1 - u);
        c.el.style.opacity = String(Math.min(1, (1 - u) * 3));
        c.el.style.transform = `translate(${c.x0 + (c.x1 - c.x0) * e}px,${c.y0 + (c.y1 - c.y0) * e}px) translate(-50%,-50%)`;
      }
    }
  }
}
