/**
 * Lightweight 2D canvas layer for the ending (no dependency on the T-13 Three scene).
 * A Painter draws one beat; the layer owns the canvas, resize and the rAF loop.
 */
import { fileUrl, hasFile } from '../../assets';

export interface Painter {
  /** `t` = seconds since this painter was set, `dt` = frame delta (s). */
  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number): void;
  dispose?(): void;
}

export class EndingLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private painter: Painter | null = null;
  private t0 = 0;
  private last = 0;
  private raf = 0;
  private w = 0;
  private h = 0;
  private readonly ro: ResizeObserver | null;

  constructor(container: HTMLElement, private readonly scale = 1) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ending-canvas';
    container.append(this.canvas);
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('2D canvas unavailable');
    this.g = g;
    this.resize();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.ro?.observe(container);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * this.scale;
    this.w = Math.max(1, Math.round((r.width || window.innerWidth) * dpr));
    this.h = Math.max(1, Math.round((r.height || window.innerHeight) * dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  setPainter(p: Painter | null): void {
    this.painter?.dispose?.();
    this.painter = p;
    this.t0 = performance.now();
  }

  private loop(now: number): void {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    if (!this.painter) return;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    try {
      this.painter.draw(g, this.w, this.h, (now - this.t0) / 1000, dt);
    } catch (err) {
      console.warn('[ending] painter failed', err);
      this.painter = null;
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.painter?.dispose?.();
    this.painter = null;
    this.canvas.remove();
  }
}

const imgCache = new Map<string, HTMLImageElement | null>();
/** Image for an asset path, or null if the file doesn't exist. Draw only when `complete`. */
export function image(path: string, webp = false): HTMLImageElement | null {
  const k = `${path}|${webp}`;
  if (imgCache.has(k)) return imgCache.get(k) ?? null;
  let img: HTMLImageElement | null = null;
  if (hasFile(path)) {
    img = new Image();
    img.src = fileUrl(path, webp);
    img.onerror = () => imgCache.set(k, null);
  }
  imgCache.set(k, img);
  return img;
}

export const ready = (img: HTMLImageElement | null): img is HTMLImageElement => !!img && img.complete && img.naturalWidth > 0;

/** Rising bubble particles (shared by dive + underwater beats). */
export class Bubbles {
  private xs: number[] = [];
  private ys: number[] = [];
  private rs: number[] = [];
  private ph: number[] = [];

  spawn(x: number, y: number, r: number): void {
    if (this.xs.length > 400) return;
    this.xs.push(x);
    this.ys.push(y);
    this.rs.push(r);
    this.ph.push(Math.random() * 6.28);
  }

  /** Step + draw. `ceil` = y above which bubbles pop (water surface). */
  draw(g: CanvasRenderingContext2D, dt: number, t: number, ceil: number, unit: number): void {
    g.strokeStyle = 'rgba(235,255,250,0.75)';
    g.fillStyle = 'rgba(235,255,250,0.18)';
    g.lineWidth = Math.max(1, unit * 0.0025);
    for (let i = this.xs.length - 1; i >= 0; i--) {
      this.ys[i] -= dt * unit * (0.08 + this.rs[i] * 6);
      const x = this.xs[i] + Math.sin(t * 3 + this.ph[i]) * unit * 0.006;
      if (this.ys[i] < ceil) {
        this.xs.splice(i, 1);
        this.ys.splice(i, 1);
        this.rs.splice(i, 1);
        this.ph.splice(i, 1);
        continue;
      }
      g.beginPath();
      g.arc(x, this.ys[i], this.rs[i] * unit, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }
}
