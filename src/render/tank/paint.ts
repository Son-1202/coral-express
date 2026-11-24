/** Procedural pixel placeholders for the Tank View (used until ART files exist). */
import type { Habitat, MotionProfile } from '../../data/schema';
import { makeCanvas, rng } from '../paint/canvas';
import { outline } from '../train/paintTrain';

const OUT = '#1e2c3a';

export const HABITAT_COLORS: Record<Habitat, { deep: string; water: string; plant: string[]; rock: string; rockLight: string }> = {
  reef: { deep: '#2a8fb4', water: '#62d3dc', plant: ['#ff8a9e', '#ffb36b', '#c08cf0', '#ff6f7d'], rock: '#c58a7c', rockLight: '#e8b4a0' },
  mangrove: { deep: '#3f6b55', water: '#8fbf9a', plant: ['#7f9a3a', '#b05a3a', '#9bbf55', '#d2a24a'], rock: '#6e5238', rockLight: '#9a7650' },
  kelp: { deep: '#1d5a4c', water: '#4f9f84', plant: ['#3e8f3a', '#c9a03a', '#5fae4a', '#8fbf3a'], rock: '#56646a', rockLight: '#7f9096' },
  polar: { deep: '#3d6f9a', water: '#a9d8ee', plant: ['#e8f4fb', '#9fd0e8', '#c8b8e8', '#7fb8d8'], rock: '#9fb4c4', rockLight: '#e4eef4' },
  vent: { deep: '#1a1c22', water: '#3b4a52', plant: ['#d8442e', '#4fb89a', '#e88a3a', '#9a3a2e'], rock: '#3b3a3c', rockLight: '#6a5f58' },
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

/** Fish placeholder: silhouette chosen by motion profile, colours hashed from the id. Faces right. */
export function paintFish(id: string, motion: MotionProfile): HTMLCanvasElement {
  const r = rng(hash(id));
  const hue = r() * 360;
  const body = hsl(hue, 75, 60);
  const dark = hsl(hue, 70, 40);
  const light = hsl(hue + 30, 80, 82);
  let p;
  switch (motion) {
    case 'crawler': {
      p = makeCanvas(20, 13);
      const c = p.ctx;
      c.fillStyle = dark;
      for (let i = 0; i < 3; i++) c.fillRect(3 + i * 4, 9, 1, 3), c.fillRect(5 + i * 4, 9, 1, 3);
      c.fillStyle = body;
      c.fillRect(3, 4, 12, 6);
      c.fillRect(5, 3, 8, 1);
      c.fillRect(15, 2, 3, 3); // claw
      c.fillRect(14, 5, 2, 2);
      c.fillStyle = '#1a1a2a';
      c.fillRect(11, 2, 1, 1), c.fillRect(13, 2, 1, 1);
      break;
    }
    case 'sessile': {
      p = makeCanvas(16, 18);
      const c = p.ctx;
      c.fillStyle = dark;
      c.fillRect(4, 12, 8, 6);
      for (let i = 0; i < 7; i++) {
        c.fillStyle = i % 2 ? body : light;
        const hgt = 6 + ((i * 5) % 5);
        c.fillRect(2 + i * 2, 12 - hgt, 1, hgt);
      }
      break;
    }
    case 'pulser': {
      p = makeCanvas(16, 18);
      const c = p.ctx;
      c.fillStyle = body;
      c.fillRect(4, 1, 8, 8);
      c.fillRect(3, 3, 10, 4);
      for (let i = 0; i < 5; i++) c.fillRect(3 + i * 2, 9, 1, 6 + (i % 2) * 2);
      c.fillStyle = '#1a1a2a';
      c.fillRect(6, 5, 1, 1), c.fillRect(9, 5, 1, 1);
      break;
    }
    case 'hoverer': {
      p = makeCanvas(11, 18);
      const c = p.ctx;
      c.fillStyle = body;
      c.fillRect(4, 3, 4, 9);
      c.fillRect(6, 1, 3, 3);
      c.fillRect(8, 2, 3, 1); // snout
      c.fillRect(3, 12, 2, 3);
      c.fillRect(4, 15, 3, 1);
      c.fillStyle = light;
      c.fillRect(3, 5, 1, 4);
      c.fillStyle = '#1a1a2a';
      c.fillRect(7, 2, 1, 1);
      break;
    }
    case 'glider':
    case 'sinuous': {
      p = makeCanvas(22, 12);
      const c = p.ctx;
      c.fillStyle = body;
      c.fillRect(6, 3, 10, 6);
      c.fillRect(8, 1, 6, 10);
      c.fillRect(1, 5, 6, 2); // tail
      c.fillStyle = light;
      c.fillRect(10, 4, 4, 2);
      c.fillStyle = '#1a1a2a';
      c.fillRect(15, 4, 1, 1);
      break;
    }
    case 'swarm': {
      p = makeCanvas(6, 4);
      const c = p.ctx;
      c.fillStyle = hsl(hue, 70, 70);
      c.fillRect(1, 1, 4, 2);
      c.fillStyle = dark;
      c.fillRect(4, 1, 1, 1);
      return p.canvas; // too small for an outline
    }
    default: {
      p = makeCanvas(16, 11);
      const c = p.ctx;
      c.translate(1, 1);
      c.fillStyle = dark;
      c.fillRect(0, 2, 3, 5);
      c.fillRect(5, 0, 4, 2);
      c.fillStyle = body;
      c.fillRect(3, 2, 9, 5);
      c.fillRect(4, 1, 6, 7);
      c.fillStyle = light;
      c.fillRect(6, 1, 1, 7);
      c.fillStyle = '#1a1a2a';
      c.fillRect(10, 3, 1, 1);
    }
  }
  outline(p.canvas, OUT);
  return p.canvas;
}

/** Plant placeholder `<habitat>_<n>`: 1 fan, 2 branching, 3 grass, 4 blob. Rooted at the bottom edge. */
export function paintPlant(habitat: Habitat, n: number): HTMLCanvasElement {
  const pal = HABITAT_COLORS[habitat];
  const r = rng(hash(`${habitat}_${n}`));
  const col = pal.plant[(n - 1) % pal.plant.length] as string;
  const tall = habitat === 'kelp' && n === 1;
  const p = makeCanvas(tall ? 14 : 20, tall ? 48 : 26);
  const { ctx: c, w, h } = p;
  c.fillStyle = col;
  const kind = ((n - 1) % 4) + 1;
  if (tall || kind === 3) {
    for (let i = 0; i < (tall ? 3 : 6); i++) {
      const x = 2 + Math.floor(r() * (w - 4));
      const hh = Math.floor(h * (0.5 + r() * 0.5));
      for (let y = h; y > h - hh; y -= 2) c.fillRect(x + ((y >> 2) % 2), y - 2, tall ? 2 : 1, 2);
      if (tall) for (let y = h - 6; y > h - hh; y -= 7) c.fillRect(x + 2, y, 3, 2);
    }
  } else if (kind === 1) {
    c.fillRect(w / 2 - 1, h - 6, 2, 6);
    for (let y = 2; y < h - 6; y++) {
      const half = Math.floor((Math.sin((y / (h - 6)) * Math.PI) * w) / 2.3);
      for (let x = -half; x <= half; x += 2) c.fillRect(w / 2 + x, y, 1, 1);
    }
  } else if (kind === 2) {
    const branch = (x: number, y: number, len: number, dir: number) => {
      for (let i = 0; i < len; i++) c.fillRect(x + Math.round(i * dir * 0.5), y - i, 2, 1);
    };
    branch(w / 2, h, h - 4, 0);
    for (let i = 0; i < 5; i++) branch(w / 2, h - 4 - Math.floor(r() * (h - 10)), 4 + Math.floor(r() * 6), r() < 0.5 ? -1 : 1);
  } else {
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.ellipse(4 + r() * (w - 8), h - 4 - r() * 8, 3 + r() * 3, 3 + r() * 3, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(6, h - 12, 2, 1);
  }
  outline(p.canvas, OUT);
  return p.canvas;
}

/** Decor placeholder: a recognisable chunky silhouette per id; unknown ids get a rock. */
export function paintDecor(id: string): HTMLCanvasElement {
  const p = makeCanvas(28, 22);
  const { ctx: c, w, h } = p;
  const rect = (col: string, x: number, y: number, ww: number, hh: number) => {
    c.fillStyle = col;
    c.fillRect(x, y, ww, hh);
  };
  switch (id) {
    case 'treasure_chest':
      rect('#8a5a3c', 5, 10, 18, 11), rect('#a8743f', 5, 6, 18, 5), rect('#e0b54a', 5, 10, 18, 1), rect('#e0b54a', 13, 9, 2, 4);
      break;
    case 'coral_castle':
      rect('#f0a89a', 4, 8, 20, 14), rect('#f0a89a', 3, 4, 5, 6), rect('#f0a89a', 20, 4, 5, 6), rect('#f0a89a', 11, 1, 6, 8), rect('#5a3a4a', 12, 14, 4, 8), rect('#5a3a4a', 13, 4, 2, 2);
      break;
    case 'mangrove_root':
      for (let i = 0; i < 5; i++) rect('#7a5a3a', 2 + i * 5, 10 + (i % 2) * 3, 3, 12 - (i % 2) * 3);
      rect('#9a7650', 2, 8, 24, 3);
      break;
    case 'sunken_rowboat':
      rect('#8a5a3c', 2, 12, 24, 6), rect('#6e4a30', 4, 18, 20, 3), rect('#a8743f', 2, 11, 24, 1), rect('#d8c3a0', 14, 4, 1, 8);
      break;
    case 'ice_arch':
      rect('#e4f4fb', 3, 4, 22, 5), rect('#e4f4fb', 3, 4, 5, 18), rect('#e4f4fb', 20, 4, 5, 18), rect('#a9d8ee', 4, 5, 3, 16);
      break;
    case 'brass_diver':
      rect('#c9a24a', 9, 1, 10, 9), rect('#3d5a6a', 11, 3, 6, 5), rect('#c9a24a', 8, 10, 12, 8), rect('#a8823a', 9, 18, 4, 4), rect('#a8823a', 15, 18, 4, 4);
      break;
    case 'basalt_pillars':
      for (let i = 0; i < 4; i++) rect(i % 2 ? '#3b3a3c' : '#55525a', 3 + i * 6, 4 + (i % 3) * 4, 5, 18 - (i % 3) * 4);
      break;
    case 'captains_wheel':
      c.strokeStyle = '#a8743f';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(14, 11, 7, 0, Math.PI * 2);
      c.stroke();
      for (let a = 0; a < 8; a++) rect('#8a5a3c', 14 + Math.round(Math.cos((a * Math.PI) / 4) * 9) - 1, 11 + Math.round(Math.sin((a * Math.PI) / 4) * 9) - 1, 2, 2);
      rect('#e0b54a', 13, 10, 3, 3);
      break;
    case 'wren_photo':
      rect('#c9a24a', 6, 2, 16, 18), rect('#f4ead2', 8, 4, 12, 14), rect('#b9a3d6', 11, 7, 6, 6), rect('#8a5a3c', 13, 20, 2, 2);
      break;
    case 'sea_glass':
      for (let i = 0; i < 7; i++) rect(['#8fd1b8', '#a9d8ee', '#f6d860', '#b9a3d6'][i % 4] as string, 3 + i * 3, h - 4 - (i % 2) * 2, 3, 3);
      break;
    default:
      c.fillStyle = '#8d7f8f';
      c.beginPath();
      c.ellipse(w / 2, h, w / 2 - 2, h - 6, 0, Math.PI, 0);
      c.fill();
      rect('#a89aa8', 8, 10, 6, 2);
  }
  outline(p.canvas, OUT);
  return p.canvas;
}

/** Backdrop placeholder: deep→light gradient, distant rock silhouettes, light shafts. */
export function paintBackdrop(habitat: Habitat): HTMLCanvasElement {
  const pal = HABITAT_COLORS[habitat];
  const p = makeCanvas(256, 144);
  const { ctx: c, w, h } = p;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, pal.water);
  g.addColorStop(1, pal.deep);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const r = rng(hash(habitat));
  for (let layer = 0; layer < 2; layer++) {
    c.fillStyle = layer ? pal.rock : pal.rockLight;
    c.globalAlpha = layer ? 0.9 : 0.5;
    for (let x = 0; x < w; x += 4) {
      const y = h * (0.62 + layer * 0.1) + Math.sin(x * 0.03 + layer * 2 + r() * 0.3) * 10 + Math.sin(x * 0.11) * 4;
      c.fillRect(x, y, 4, h - y);
    }
  }
  c.globalAlpha = 1;
  return p.canvas;
}

/** Blurry coast strip seen through the back glass (sky, sea, headlands). Tiles horizontally. */
export function paintCoast(line: number): HTMLCanvasElement {
  const p = makeCanvas(256, 64);
  const { ctx: c, w, h } = p;
  const sky = ['#a9def0', '#b8c8d8', '#f0c8a0'][line - 1] ?? '#a9def0';
  const land = ['#9fb8c8', '#5a6f86', '#3b3a3c'][line - 1] ?? '#9fb8c8';
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  c.fillStyle = land;
  for (let x = 0; x < w; x++) {
    const y = h * 0.45 + Math.sin((x / w) * Math.PI * 4) * 6 + Math.sin((x / w) * Math.PI * 10) * 3;
    c.fillRect(x, y, 1, h - y);
  }
  c.fillStyle = '#3fc0c4';
  c.fillRect(0, h * 0.7, w, h * 0.3);
  return p.canvas;
}

/** Tiny conductor's cap (navy crown, brass band, black visor), 12×8. */
export function paintCap(): HTMLCanvasElement {
  const p = makeCanvas(12, 8);
  const c = p.ctx;
  c.fillStyle = '#2b3f63';
  c.fillRect(1, 1, 9, 4);
  c.fillRect(2, 0, 7, 1);
  c.fillStyle = '#c9a24a';
  c.fillRect(1, 4, 9, 1);
  c.fillRect(5, 2, 1, 1);
  c.fillStyle = '#1a1a2a';
  c.fillRect(6, 5, 6, 2);
  outline(p.canvas, OUT);
  return p.canvas;
}

/** Sight placeholders (zoo + later train view). */
export function paintSight(id: string): HTMLCanvasElement {
  const p = makeCanvas(32, 20);
  const c = p.ctx;
  const rect = (col: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };
  switch (id) {
    case 'dolphin_race':
      rect('#7f9fb8', 6, 8, 20, 6), rect('#7f9fb8', 24, 10, 6, 2), rect('#7f9fb8', 13, 4, 4, 4), rect('#7f9fb8', 2, 6, 4, 4), rect('#e4eef4', 10, 12, 14, 2);
      break;
    case 'seagull_thief':
      rect('#ffffff', 10, 8, 12, 6), rect('#dbe9f2', 2, 6, 9, 3), rect('#dbe9f2', 21, 6, 9, 3), rect('#ffb33a', 22, 10, 4, 2), rect('#1a1a2a', 20, 9, 1, 1);
      break;
    case 'whale_breach':
      rect('#3d5a7a', 4, 6, 22, 12), rect('#3d5a7a', 0, 4, 6, 4), rect('#c8d8e4', 8, 14, 16, 4), rect('#1a1a2a', 22, 9, 1, 1);
      break;
    case 'festival_station':
      for (let i = 0; i < 6; i++) rect(['#e45b4f', '#f6d860', '#2aa5a0'][i % 3] as string, 2 + i * 5, 4 + (i % 2), 4, 6);
      rect('#8a5a3c', 0, 3, 32, 1);
      break;
    case 'stowaway':
      rect('#a8743f', 6, 8, 20, 12), rect('#8a5a3c', 6, 8, 20, 2), rect('#ff8a2a', 12, 4, 8, 5), rect('#1a1a2a', 17, 5, 1, 1);
      break;
    default:
      c.fillStyle = 'rgba(240,245,250,0.9)';
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.ellipse(5 + i * 4.5, 11 + (i % 2) * 2, 6, 4, 0, 0, Math.PI * 2);
        c.fill();
      }
      return p.canvas;
  }
  outline(p.canvas, OUT);
  return p.canvas;
}
