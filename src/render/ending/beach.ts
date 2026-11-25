/**
 * Ending beats 1 + 3: the train slows on the black-sand beach, then follows the rails down the
 * sand into the sea while the camera follows and the water line rises over the screen.
 * World units: 1 = canvas height. Procedural painting + the real train sprites when present.
 */
import { clamp01, lerp, smoothstep } from '../anim/ease';
import { BEACH_Y, K, paintNearRocks, paintSand, paintSea, SEA_Y, SLOPE_X } from './beachPaint';
import { CAR_ART_H, EndingCarriage, PuffSteam } from './carriages';
import { Bubbles, image, ready, type Painter } from './layer';
import type { EndingCar } from './owned';

const CAR_H = 0.12;
const LOCO_W = CAR_H * (320 / 151);
const CAR_W = CAR_H * (288 / 148);
const GAP = 0.012;
/** One main-game world unit in ending units (main car art is 148/104 world units tall). */
const MAIN_UNIT = CAR_H / (148 / 104);
/** Chimney top on locomotive.png (fraction of width from the front, of height from the top). */
const CHIMNEY = { fromFront: 0.22, fromTop: 0.02 };

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
  private readonly steam = new PuffSteam();
  private readonly loco = image('/train/locomotive.png');
  private readonly shell = image('/train/car_shell.png');
  /** Line 3 dusk painting as the beach backdrop (procedural sky when missing). */
  private readonly far = image('/scenery/l3_far_dusk.png', true);
  /** Line 3 mid art: its boulder row is the painted foreground of the beach. */
  private readonly rocks = image('/scenery/l3_mid.png', true);
  private readonly carriages: EndingCarriage[];
  private bubT = 0;
  private lastFront = -1;

  /**
   * `progress` returns [phase, u] each frame (driven by the ending timeline). `cars` = the
   * player's carriages (habitat + fish); at least one (empty reef) is drawn.
   */
  constructor(private readonly progress: () => { phase: 'beach' | 'dive'; u: number }, cars: readonly EndingCar[] = []) {
    const list = cars.length ? cars.slice(0, 8) : [{ habitat: 'reef', fish: [] }];
    this.carriages = list.map((c, i) => new EndingCarriage(c, i + 1));
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number): void {
    const { phase, u } = this.progress();
    const s0 = frontAt(phase, u);
    const speed = this.lastFront < 0 || dt <= 0 ? 0 : Math.max(0, (s0 - this.lastFront) / dt);
    this.lastFront = s0;
    const front = railAt(s0);
    const aspect = w / h;
    // camera: keep the locomotive at ~58% of the width, sink with it once it's under water
    const camX = front.x - aspect * 0.58;
    const sink = Math.max(0, front.y - SEA_Y + 0.05);
    const camY = phase === 'dive' ? sink * 0.9 : 0;

    this.sky(g, w, h, camX, camY);
    g.setTransform(h, 0, 0, h, -camX * h, -camY * h);
    paintSand(g, camX, aspect, t);
    paintNearRocks(g, this.rocks, camX, aspect);
    this.rails(g, camX, aspect);
    this.train(g, s0, t, dt, speed);
    paintSea(g, camX, aspect, t);

    // bubbles from submerged cars
    this.bubT -= dt;
    if (this.bubT <= 0) {
      this.bubT = 0.04;
      for (let i = 0; i <= this.carriages.length; i++) {
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

  private sky(g: CanvasRenderingContext2D, w: number, h: number, camX: number, camY: number): void {
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
    const far = this.far;
    if (far && ready(far)) {
      // painted Line 3 dusk: horizon (≈ middle of the painting) on the far sea band, slow parallax
      const ih = h * 0.62 * 2;
      const iw = (ih * far.naturalWidth) / far.naturalHeight;
      let x0 = -((camX * h * 0.08) % iw);
      if (x0 > 0) x0 -= iw;
      g.imageSmoothingEnabled = true;
      for (let x = x0; x < w; x += iw) g.drawImage(far, x, h * 0.62 - ih / 2 - h * 0.02, iw, ih);
      g.imageSmoothingEnabled = false;
      return;
    }
    // far volcano (slow parallax) + soft smoke
    const vx = w * 0.72 - camX * h * 0.08;
    g.fillStyle = '#7d6f78';
    g.beginPath();
    g.moveTo(vx - h * 0.55, h * 0.62);
    g.lineTo(vx - h * 0.07, h * 0.3);
    g.lineTo(vx + h * 0.06, h * 0.3);
    g.lineTo(vx + h * 0.6, h * 0.62);
    g.fill();
    const sea = g.createLinearGradient(0, h * 0.58, 0, h);
    sea.addColorStop(0, '#e0a98a');
    sea.addColorStop(1, '#2f7f8c');
    g.fillStyle = sea;
    g.fillRect(0, h * 0.6, w, h * 2.4);
  }

  private rails(g: CanvasRenderingContext2D, camX: number, aspect: number): void {
    g.strokeStyle = '#3a2a22';
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
    g.strokeStyle = '#b9a79a';
    g.lineWidth = 0.005;
    g.beginPath();
    const first = Math.max(0, camX - 0.2);
    for (let s = first; s < camX + aspect + 0.4; s += 0.02) {
      const p = railAt(s);
      if (s === first) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.stroke();
  }

  private train(g: CanvasRenderingContext2D, s0: number, t: number, dt: number, speed: number): void {
    const bob = Math.sin(t * 9) * 0.0015 * Math.min(1, speed * 4);
    const n = this.carriages.length;
    // carriages first (behind), then the locomotive
    for (let i = n; i >= 0; i--) {
      const isLoco = i === 0;
      const wdt = isLoco ? LOCO_W : CAR_W;
      const back = isLoco ? 0 : LOCO_W + GAP + (i - 1) * (CAR_W + GAP);
      const mid = railAt(s0 - back - wdt / 2);
      g.save();
      g.translate(mid.x, mid.y + bob * (i % 2 ? 1 : -1));
      g.rotate(mid.a);
      if (isLoco) {
        if (ready(this.loco)) g.drawImage(this.loco, -wdt / 2, -CAR_H, wdt, CAR_H);
        else {
          g.fillStyle = '#5fa88f';
          g.fillRect(-wdt / 2, -CAR_H, wdt, CAR_H * 0.85);
        }
      } else {
        const car = this.carriages[i - 1];
        g.translate(-wdt / 2, -CAR_H);
        g.scale(CAR_H / CAR_ART_H, CAR_H / CAR_ART_H);
        car?.drawInside(g, t, dt, Math.sin(mid.a) * 0.8);
        if (ready(this.shell)) g.drawImage(this.shell, 0, 0);
        else {
          g.strokeStyle = '#d9ac4c';
          g.lineWidth = 4;
          g.strokeRect(22, 25, 244, 77);
          g.fillStyle = '#7cc2a8';
          g.fillRect(0, 102, 288, 30);
        }
      }
      g.restore();
    }
    // chimney steam while above water (same puff look as the main train)
    const chim = railAt(s0 - LOCO_W * CHIMNEY.fromFront);
    const lift = CAR_H * (1 - CHIMNEY.fromTop);
    const top = { x: chim.x + Math.sin(chim.a) * lift, y: chim.y - Math.cos(chim.a) * lift };
    this.steam.update(g, dt, top.y < SEA_Y - 0.01 ? top : null, speed / MAIN_UNIT, MAIN_UNIT);
  }
}
