/**
 * Ending beats 1 + 3: the train slows on the black-sand beach, then follows the rails down the
 * sand into the sea while the camera follows and the water line rises over the screen.
 * World units: 1 = canvas height. Procedural painting + the real train sprites when present.
 */
import { clamp01, lerp, smoothstep } from '../anim/ease';
import { Bubbles, image, ready, type Painter } from './layer';

const BEACH_Y = 0.7; // rail height on the beach (world y, down = +)
const SEA_Y = 0.74; // water surface
const SLOPE_X = 1.9; // rails start descending here
const K = 0.32; // slope (dy/dx)
const CAR_H = 0.12;
const LOCO_W = CAR_H * (320 / 151);
const CAR_W = CAR_H * (288 / 148);
const GAP = 0.012;

/** Point on the rails at arc length s (from x=0). */
export function railAt(s: number): { x: number; y: number; a: number } {
  if (s <= SLOPE_X) return { x: s, y: BEACH_Y, a: 0 };
  const c = 1 / Math.sqrt(1 + K * K);
  const d = s - SLOPE_X;
  // soft knee over the first 0.25 units so cars don't snap to the slope angle
  const knee = smoothstep(clamp01(d / 0.25));
  return { x: SLOPE_X + d * c, y: BEACH_Y + d * c * K * knee, a: Math.atan(K) * knee };
}

/** Train front arc length over the two beats. */
export function frontAt(phase: 'beach' | 'dive', u: number): number {
  const x = clamp01(u);
  if (phase === 'beach') return lerp(0.25, 1.75, 1 - Math.pow(1 - x, 2.6)); // decelerate to a stop
  return lerp(1.75, 3.9, x * x * (1.4 - 0.4 * x)); // ease in, rolling downhill
}

export class BeachPainter implements Painter {
  private readonly bubbles = new Bubbles();
  private readonly puffs: { x: number; y: number; r: number; age: number }[] = [];
  private readonly loco = image('/train/locomotive.png');
  private readonly car = image('/train/car_shell.png');
  private puffT = 0;
  private bubT = 0;

  /** `progress` returns [phase, u] each frame (driven by the ending timeline). */
  constructor(private readonly progress: () => { phase: 'beach' | 'dive'; u: number }, private readonly cars = 3) {}

  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number): void {
    const { phase, u } = this.progress();
    const s0 = frontAt(phase, u);
    const front = railAt(s0);
    const aspect = w / h;
    // camera: keep the locomotive at ~58% of the width, sink with it once it's under water
    const camX = front.x - aspect * 0.58;
    const sink = Math.max(0, front.y - SEA_Y + 0.05);
    const camY = phase === 'dive' ? sink * 0.9 : 0;

    this.sky(g, w, h, t, camX, camY);
    g.setTransform(h, 0, 0, h, -camX * h, -camY * h);

    // beach + seabed
    g.fillStyle = '#2b2a30';
    g.beginPath();
    g.moveTo(camX - 1, BEACH_Y + 0.02);
    for (let x = camX - 1; x <= camX + aspect + 1; x += 0.05) {
      const y = x < SLOPE_X ? BEACH_Y + 0.02 : BEACH_Y + 0.02 + (x - SLOPE_X) * K;
      g.lineTo(x, y);
    }
    g.lineTo(camX + aspect + 1, 9);
    g.lineTo(camX - 1, 9);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.floor(camX) - 1 + ((i * 0.37) % (aspect + 2)), BEACH_Y + 0.04 + ((i * 0.13) % 0.2), 0.008, 0.004);

    this.rails(g, camX, aspect);
    this.train(g, s0, t, dt, phase);
    this.water(g, w, h, t, camX, aspect);

    // bubbles from submerged cars
    this.bubT -= dt;
    if (this.bubT <= 0) {
      this.bubT = 0.04;
      for (let i = 0; i <= this.cars; i++) {
        const p = railAt(s0 - i * (CAR_W + GAP) - 0.1);
        if (p.y > SEA_Y + 0.03) this.bubbles.spawn(p.x + (Math.random() - 0.5) * 0.2, p.y - Math.random() * CAR_H, 0.003 + Math.random() * 0.008);
      }
    }
    this.bubbles.draw(g, dt, t, SEA_Y, 1);
    g.setTransform(1, 0, 0, 1, 0, 0);

    // underwater tint deepens as the camera sinks (hands over to the video / panorama)
    const deep = clamp01(camY / 0.8);
    if (deep > 0) {
      g.fillStyle = `rgba(8,48,66,${(deep * 0.55).toFixed(3)})`;
      g.fillRect(0, 0, w, h);
    }
  }

  private sky(g: CanvasRenderingContext2D, w: number, h: number, t: number, camX: number, camY: number): void {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#f6c6a0';
    g.fillRect(0, 0, w, h);
    // the backdrop scrolls up with the sinking camera (slightly slower: parallax)
    g.setTransform(1, 0, 0, 1, 0, -camY * h * 0.9);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#f6c6a0');
    sky.addColorStop(0.55, '#f9e2b8');
    sky.addColorStop(1, '#bfe3da');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // far volcano (slow parallax) + smoke
    const vx = w * 0.72 - camX * h * 0.08;
    g.fillStyle = '#7d6f78';
    g.beginPath();
    g.moveTo(vx - h * 0.55, h * 0.62);
    g.lineTo(vx - h * 0.07, h * 0.3);
    g.lineTo(vx + h * 0.06, h * 0.3);
    g.lineTo(vx + h * 0.6, h * 0.62);
    g.fill();
    g.fillStyle = 'rgba(240,236,230,0.55)';
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.06 + i / 6) % 1;
      g.beginPath();
      g.arc(vx + k * h * 0.12, h * (0.28 - k * 0.2), h * (0.025 + k * 0.05), 0, Math.PI * 2);
      g.fill();
    }
    // far sea band
    const sea = g.createLinearGradient(0, h * 0.58, 0, h);
    sea.addColorStop(0, '#5fc4bd');
    sea.addColorStop(1, '#1f7f8c');
    g.fillStyle = sea;
    g.fillRect(0, h * 0.6, w, h * 2.4);
  }

  private rails(g: CanvasRenderingContext2D, camX: number, aspect: number): void {
    g.strokeStyle = '#6b4a2e';
    g.lineWidth = 0.008;
    for (let s = Math.max(0, camX - 0.2); s < camX + aspect + 0.4; s += 0.045) {
      const p = railAt(s);
      g.save();
      g.translate(p.x, p.y + 0.006);
      g.rotate(p.a);
      g.beginPath();
      g.moveTo(-0.012, 0);
      g.lineTo(0.012, 0);
      g.stroke();
      g.restore();
    }
    g.strokeStyle = '#b9b3a6';
    g.lineWidth = 0.005;
    g.beginPath();
    for (let s = Math.max(0, camX - 0.2); s < camX + aspect + 0.4; s += 0.02) {
      const p = railAt(s);
      if (s === Math.max(0, camX - 0.2)) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.stroke();
  }

  private train(g: CanvasRenderingContext2D, s0: number, t: number, dt: number, phase: 'beach' | 'dive'): void {
    const bob = Math.sin(t * 9) * 0.0015;
    // carriages first (behind), then the locomotive
    for (let i = this.cars; i >= 0; i--) {
      const isLoco = i === 0;
      const wdt = isLoco ? LOCO_W : CAR_W;
      const back = isLoco ? 0 : LOCO_W + GAP + (i - 1) * (CAR_W + GAP);
      const mid = railAt(s0 - back - wdt / 2);
      g.save();
      g.translate(mid.x, mid.y + bob * (i % 2 ? 1 : -1));
      g.rotate(mid.a);
      const img = isLoco ? this.loco : this.car;
      if (ready(img)) g.drawImage(img, -wdt / 2, -CAR_H, wdt, CAR_H);
      else {
        g.fillStyle = isLoco ? '#5fa88f' : 'rgba(170,230,230,0.8)';
        g.fillRect(-wdt / 2, -CAR_H, wdt, CAR_H * 0.85);
        g.fillStyle = '#d9ac4c';
        g.fillRect(-wdt / 2, -CAR_H * 0.2, wdt, CAR_H * 0.05);
      }
      g.restore();
    }
    // chimney steam while above water
    const chim = railAt(s0 - LOCO_W * 0.25);
    this.puffT -= dt;
    if (chim.y < SEA_Y && this.puffT <= 0) {
      this.puffT = phase === 'beach' ? 0.22 : 0.35;
      this.puffs.push({ x: chim.x, y: chim.y - CAR_H * 1.05, r: 0.012, age: 0 });
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      p.y -= dt * 0.05;
      p.x -= dt * 0.04;
      p.r += dt * 0.02;
      if (p.age > 2.5) {
        this.puffs.splice(i, 1);
        continue;
      }
      g.fillStyle = `rgba(255,255,255,${(0.7 * (1 - p.age / 2.5)).toFixed(3)})`;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
  }

  private water(g: CanvasRenderingContext2D, _w: number, _h: number, t: number, camX: number, aspect: number): void {
    const x0 = Math.max(SLOPE_X + (SEA_Y - BEACH_Y - 0.02) / K - 0.01, camX - 0.2);
    const x1 = camX + aspect + 0.3;
    if (x1 <= x0) return;
    const grad = g.createLinearGradient(0, SEA_Y, 0, SEA_Y + 1.6);
    grad.addColorStop(0, 'rgba(70,190,190,0.55)');
    grad.addColorStop(0.3, 'rgba(25,110,140,0.72)');
    grad.addColorStop(1, 'rgba(8,40,70,0.92)');
    g.fillStyle = grad;
    g.beginPath();
    const wave = (x: number) => SEA_Y + Math.sin(x * 22 + t * 2.2) * 0.004 + Math.sin(x * 9 - t * 1.3) * 0.003;
    g.moveTo(x0, wave(x0));
    for (let x = x0; x <= x1; x += 0.02) g.lineTo(x, wave(x));
    g.lineTo(x1, 9);
    g.lineTo(x0, 9);
    g.closePath();
    g.fill();
    // foam line where the sea meets the sand + surface highlight
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 0.004;
    g.beginPath();
    g.moveTo(x0, wave(x0));
    for (let x = x0; x <= x1; x += 0.02) g.lineTo(x, wave(x));
    g.stroke();
    // light rays under the surface
    g.fillStyle = 'rgba(220,255,245,0.06)';
    for (let i = 0; i < 6; i++) {
      const rx = Math.floor(camX) + i * 0.45 + Math.sin(t * 0.4 + i) * 0.05;
      if (rx < x0) continue;
      g.beginPath();
      g.moveTo(rx, SEA_Y);
      g.lineTo(rx + 0.08, SEA_Y);
      g.lineTo(rx + 0.3, SEA_Y + 1.2);
      g.lineTo(rx + 0.12, SEA_Y + 1.2);
      g.fill();
    }
  }
}
