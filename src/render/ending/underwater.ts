/**
 * Ending beats 4–5: underwater. Two uses:
 *  - fallback for the `ending_dive` clip (Low quality / missing video): the ending key art with
 *    a slow Ken-Burns pan plus procedural wild fish swarms;
 *  - the wide panorama: every species the player owns swimming with its T-15 motion profile.
 * Coordinates: canvas pixels with y up for the movers (MotionBounds.floorY = minY).
 */
import { PATHS } from '../../assets';
import { createMover, isSwarm, type MotionBounds, type MotionProfile, type Mover } from '../tank/motion';
import { Bubbles, image, ready, type Painter } from './layer';

export interface EndingFish {
  species: string;
  motion: MotionProfile;
  shiny?: boolean;
}

interface Actor {
  fish: EndingFish | null;
  mover: Mover;
  img: HTMLImageElement | null;
  color: string;
  /** Sprite half-height (px). */
  size: number;
}

const hashHue = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
};

export interface UnderwaterOptions {
  fish: readonly EndingFish[];
  /** Background still (Ken-Burns) instead of the painted gradient. */
  backdrop?: string;
  /** Number of wild silver swarms (the "wild cousins"). */
  wildSwarms?: number;
  seed?: number;
}

export class UnderwaterPainter implements Painter {
  private actors: Actor[] = [];
  private w = 0;
  private h = 0;
  private readonly bubbles = new Bubbles();
  private readonly bg: HTMLImageElement | null;
  private bubT = 0;

  constructor(private readonly o: UnderwaterOptions) {
    this.bg = o.backdrop ? image(o.backdrop, true) : null;
  }

  private build(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const b: MotionBounds = { minX: w * 0.04, maxX: w * 0.96, minY: h * 0.1, maxY: h * 0.9, floorY: h * 0.1 };
    const n = Math.max(1, this.o.fish.length);
    // sprite half-height: crowd-aware so 18 species still fit
    const size = Math.max(h * 0.022, Math.min(h * 0.055, (h * 0.6) / Math.sqrt(n * 4)));
    let seed = this.o.seed ?? 7;
    this.actors = this.o.fish.map((f) => {
      const path = PATHS.fish(f.species, !!f.shiny);
      const img = image(path) ?? (f.shiny ? image(PATHS.fish(f.species)) : null);
      const sz = f.motion === 'swarm' ? size * 0.35 : size;
      const mover = createMover(f.motion, seed++, b, { size: sz });
      return { fish: f, mover, img, color: `hsl(${hashHue(f.species)} 65% 60%)`, size: sz };
    });
    for (let i = 0; i < (this.o.wildSwarms ?? 2); i++) {
      this.actors.push({ fish: null, mover: createMover('swarm', 900 + i, b, { size: h * 0.0065, count: 60 }), img: null, color: i % 2 ? '#dfe9ee' : '#f2d77a', size: h * 0.0065 });
    }
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number): void {
    if (w !== this.w || h !== this.h) this.build(w, h);
    this.backdrop(g, w, h, t);
    const env = { time: t, bounds: { minX: w * 0.04, maxX: w * 0.96, minY: h * 0.1, maxY: h * 0.9, floorY: h * 0.1 }, tilt: 0, food: null };
    for (const a of this.actors) {
      a.mover.step(Math.min(dt, 0.05), env);
      if (isSwarm(a.mover)) this.drawSwarm(g, a, h);
      else this.drawFish(g, a, h, t);
    }
    this.bubT -= dt;
    if (this.bubT <= 0) {
      this.bubT = 0.12;
      this.bubbles.spawn(Math.random() * w, h * 1.02, 0.002 + Math.random() * 0.006);
    }
    this.bubbles.draw(g, dt, t, -10, h);
  }

  private backdrop(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    if (ready(this.bg)) {
      // slow Ken-Burns: scale 1.05 → 1.15 over ~20 s, drifting left/up
      const k = Math.min(1, t / 20);
      const s = 1.05 + 0.1 * k;
      const iw = this.bg.naturalWidth;
      const ih = this.bg.naturalHeight;
      const cover = Math.max(w / iw, h / ih) * s;
      const dw = iw * cover;
      const dh = ih * cover;
      g.imageSmoothingEnabled = true;
      g.drawImage(this.bg, (w - dw) / 2 - k * w * 0.03, (h - dh) / 2 - k * h * 0.02, dw, dh);
      g.imageSmoothingEnabled = false;
      return;
    }
    const sea = g.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, '#3fb3b8');
    sea.addColorStop(0.45, '#17708a');
    sea.addColorStop(1, '#0a2f4a');
    g.fillStyle = sea;
    g.fillRect(0, 0, w, h);
    // god rays
    g.fillStyle = 'rgba(225,255,240,0.07)';
    for (let i = 0; i < 7; i++) {
      const x = (i / 7) * w + Math.sin(t * 0.3 + i * 1.7) * w * 0.03;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + w * 0.05, 0);
      g.lineTo(x + w * 0.2, h);
      g.lineTo(x + w * 0.1, h);
      g.fill();
    }
    // seabed, kelp silhouettes and the train resting on its rails
    g.fillStyle = '#c9b48a';
    g.beginPath();
    g.moveTo(0, h * 0.92);
    for (let x = 0; x <= w; x += w / 24) g.lineTo(x, h * (0.9 + 0.02 * Math.sin(x * 0.01)));
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    g.strokeStyle = 'rgba(30,90,60,0.55)';
    g.lineWidth = Math.max(2, h * 0.008);
    for (let i = 0; i < 9; i++) {
      const x = ((i * 0.13 + 0.04) % 1) * w;
      g.beginPath();
      g.moveTo(x, h * 0.92);
      for (let k = 1; k <= 8; k++) g.lineTo(x + Math.sin(t * 0.8 + k * 0.6 + i) * h * 0.012 * k * 0.3, h * (0.92 - k * 0.035));
      g.stroke();
    }
  }

  private drawFish(g: CanvasRenderingContext2D, a: Actor, h: number, t: number): void {
    const p = a.mover.pose;
    const size = a.size;
    g.save();
    g.translate(p.x, h - p.y);
    g.rotate(-p.rot);
    const wob = 1 + Math.sin(t * p.wobbleFreq) * p.wobbleAmp * 0.5;
    g.scale(p.facing * p.sx * wob, p.sy);
    if (ready(a.img)) {
      const hh = size * 2;
      const ww = hh * (a.img.naturalWidth / a.img.naturalHeight);
      g.drawImage(a.img, -ww / 2, -hh / 2, ww, hh);
    } else {
      g.fillStyle = a.color;
      g.beginPath();
      g.ellipse(0, 0, size * 1.3, size * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-size * 1.1, 0);
      g.lineTo(-size * 1.9, -size * 0.6);
      g.lineTo(-size * 1.9, size * 0.6);
      g.fill();
      g.fillStyle = '#1b2a30';
      g.fillRect(size * 0.7, -size * 0.2, size * 0.2, size * 0.2);
    }
    g.restore();
  }

  private drawSwarm(g: CanvasRenderingContext2D, a: Actor, h: number): void {
    const m = a.mover;
    if (!isSwarm(m)) return;
    const s = a.size;
    const img = ready(a.img) ? a.img : null;
    g.fillStyle = a.color;
    for (let i = 0; i < m.count; i++) {
      const x = m.xs[i];
      const y = h - m.ys[i];
      const dir = m.vxs[i] >= 0 ? 1 : -1;
      if (img) {
        const hh = s * 2;
        const ww = hh * (img.naturalWidth / img.naturalHeight);
        g.save();
        g.translate(x, y);
        g.scale(dir, 1);
        g.drawImage(img, -ww / 2, -hh / 2, ww, hh);
        g.restore();
      } else {
        g.beginPath();
        g.ellipse(x, y, s * 1.4, s * 0.55, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(x - dir * s * 1.2, y);
        g.lineTo(x - dir * s * 2.1, y - s * 0.6);
        g.lineTo(x - dir * s * 2.1, y + s * 0.6);
        g.fill();
      }
    }
  }
}
