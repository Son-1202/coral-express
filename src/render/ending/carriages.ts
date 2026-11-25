/**
 * Ending beach train pieces (2D canvas): the player's actual carriages — painted habitat
 * interior + their fish swimming with the T-15 motion profiles, framed by the real car_shell art —
 * and soft chimney steam in the same puff style as the main train (render/train/steam.ts).
 * Local units: car-art pixels (car_shell.png is 288×148; its glass cut-out is x 24..263, y 27..99).
 */
import { PATHS } from '../../assets';
import { createMover, isSwarm, type MotionBounds, type MotionEnv, type Mover } from '../tank/motion';
import { paintPuff } from '../train/paintTrain';
import { image, ready } from './layer';
import type { EndingCar } from './owned';

export const CAR_ART_W = 288;
export const CAR_ART_H = 148;
const WIN = { x: 24, y: 27, w: 240, h: 73 };
/** Water line inside the window (fraction of the window height from the top): air gap above. */
const AIR = 0.14;

const HABITAT_WATER: Record<string, [string, string]> = {
  reef: ['#62d3dc', '#2a8fb4'],
  mangrove: ['#8fb38a', '#4d6b4a'],
  kelp: ['#4fa38b', '#1d5a55'],
  polar: ['#bfe6f2', '#5c9cc4'],
  vent: ['#3f6c6e', '#1d2b33'],
};

interface CarFish {
  mover: Mover;
  img: HTMLImageElement | null;
  size: number;
  color: string;
}

/** Window-local bounds (art px, y up from the sand line). */
function bounds(): MotionBounds {
  const waterH = WIN.h * (1 - AIR);
  return { minX: 8, maxX: WIN.w - 8, minY: 6, maxY: waterH - 6, floorY: 6 };
}

const hue = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
};

/** One carriage: interior + fish, drawn in car-art pixel space. */
export class EndingCarriage {
  private readonly interior: HTMLImageElement | null;
  private readonly fish: CarFish[];
  private readonly water: [string, string];

  constructor(readonly car: EndingCar, seed: number) {
    this.interior = image(PATHS.interior(car.habitat), true);
    this.water = HABITAT_WATER[car.habitat] ?? HABITAT_WATER.reef ?? ['#62d3dc', '#2a8fb4'];
    const b = bounds();
    this.fish = car.fish.map((f, i) => {
      const size = f.motion === 'swarm' ? 2.2 : 8.5;
      const mover = createMover(f.motion, seed * 31 + i, b, { size, count: f.motion === 'swarm' ? 14 : undefined });
      const img = image(PATHS.fish(f.species, !!f.shiny)) ?? (f.shiny ? image(PATHS.fish(f.species)) : null);
      return { mover, img, size, color: `hsl(${hue(f.species)} 65% 60%)` };
    });
  }

  /** Draw with the current transform mapping car-art px → canvas (origin = sprite top-left). */
  drawInside(g: CanvasRenderingContext2D, t: number, dt: number, tilt: number): void {
    g.save();
    g.beginPath();
    g.rect(WIN.x, WIN.y, WIN.w, WIN.h);
    g.clip();
    this.backdrop(g, t);
    const b = bounds();
    const env: MotionEnv = { time: t, bounds: b, tilt, food: null };
    const floorY = WIN.y + WIN.h - 3; // sand line (canvas y, down)
    for (const f of this.fish) {
      f.mover.step(Math.min(dt, 0.05), env);
      this.drawFish(g, f, WIN.x, floorY, t);
    }
    // air gap + water line + glass sheen
    const airH = WIN.h * AIR;
    const wl = WIN.y + airH + Math.sin(t * 2.2) * 0.6;
    g.fillStyle = 'rgba(222,244,244,0.9)';
    g.fillRect(WIN.x, WIN.y, WIN.w, wl - WIN.y);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(WIN.x, wl, WIN.w, 1.5);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 3; i++) {
      const x = WIN.x + 30 + i * 85;
      g.beginPath();
      g.moveTo(x, WIN.y);
      g.lineTo(x + 14, WIN.y);
      g.lineTo(x - 10, WIN.y + WIN.h);
      g.lineTo(x - 24, WIN.y + WIN.h);
      g.fill();
    }
    g.restore();
  }

  private backdrop(g: CanvasRenderingContext2D, t: number): void {
    const img = this.interior;
    if (ready(img)) {
      // cover-crop like the train tank shader: full width, the lower band of the painting
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const sh = Math.min(ih, (iw * WIN.h) / WIN.w);
      const sy = Math.max(0, ih * 0.92 - sh);
      const sway = Math.sin(t * 1.7) * 0.6;
      g.imageSmoothingEnabled = true;
      g.drawImage(img, 0, sy, iw, sh, WIN.x + sway - 1, WIN.y, WIN.w + 2, WIN.h);
      g.imageSmoothingEnabled = false;
      return;
    }
    const [water, deep] = this.water;
    const grad = g.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h);
    grad.addColorStop(0, water);
    grad.addColorStop(1, deep);
    g.fillStyle = grad;
    g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    g.fillStyle = '#e8d6a8';
    g.fillRect(WIN.x, WIN.y + WIN.h - 8, WIN.w, 8);
  }

  private drawFish(g: CanvasRenderingContext2D, f: CarFish, ox: number, floorY: number, t: number): void {
    const m = f.mover;
    if (isSwarm(m)) {
      g.fillStyle = f.color;
      for (let i = 0; i < m.count; i++) {
        const x = ox + (m.xs[i] ?? 0);
        const y = floorY - (m.ys[i] ?? 0);
        if (ready(f.img)) {
          const hh = f.size * 2;
          const ww = hh * (f.img.naturalWidth / f.img.naturalHeight);
          g.save();
          g.translate(x, y);
          g.scale((m.vxs[i] ?? 1) >= 0 ? 1 : -1, 1);
          g.drawImage(f.img, -ww / 2, -hh / 2, ww, hh);
          g.restore();
        } else g.fillRect(x - 2, y - 1, 4, 2);
      }
      return;
    }
    const p = m.pose;
    g.save();
    g.translate(ox + p.x, floorY - p.y);
    g.rotate(-p.rot);
    const wob = 1 + Math.sin(t * p.wobbleFreq) * p.wobbleAmp * 0.5;
    g.scale(p.facing * p.sx * wob, p.sy);
    const hh = f.size * 2;
    if (ready(f.img)) {
      const ww = hh * (f.img.naturalWidth / f.img.naturalHeight);
      g.drawImage(f.img, -ww / 2, -hh / 2, ww, hh);
    } else {
      g.fillStyle = f.color;
      g.beginPath();
      g.ellipse(0, 0, f.size * 1.2, f.size * 0.65, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

/** Soft chimney steam: same puff sprite, rate, drift and fade curve as the main train's Steam. */
export class PuffSteam {
  private readonly tex = paintPuff();
  private readonly puffs: { x: number; y: number; vx: number; vy: number; age: number; life: number }[] = [];
  private acc = 0;

  /** `unit` = world size of one main-game world unit (car height / 1.42). `speed` in those units/s. */
  update(g: CanvasRenderingContext2D, dt: number, origin: { x: number; y: number } | null, speed: number, unit: number): void {
    if (origin) {
      this.acc += dt * (1.2 + speed * 2.2);
      while (this.acc >= 1 && this.puffs.length < 40) {
        this.acc -= 1;
        this.puffs.push({ x: origin.x, y: origin.y, vx: -speed * 0.35 - 0.1 + Math.random() * 0.15, vy: 0.5 + Math.random() * 0.25, age: 0, life: 1.8 + Math.random() * 1.2 });
      }
    }
    g.imageSmoothingEnabled = true;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      if (!p) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        this.puffs.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt * unit;
      p.y -= p.vy * dt * (1 - k * 0.6) * unit;
      const s = (0.32 + k * 1.3) * unit;
      g.globalAlpha = Math.min(1, k * 6) * (1 - k) * 0.95;
      g.drawImage(this.tex, p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
  }
}
