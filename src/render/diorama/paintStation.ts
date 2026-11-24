import { makeCanvas, rng, pick, shade } from '../paint/canvas';
import { SUNNY } from '../paint/palette';
import { PX } from './paintTrack';

export const STATION_BUILDING = { w: 8, h: 4 } as const;

function person(ctx: CanvasRenderingContext2D, x: number, base: number, coat: string, hat: string): void {
  ctx.fillStyle = '#3c3a46';
  ctx.fillRect(x + 1, base - 5, 2, 5);
  ctx.fillRect(x + 4, base - 5, 2, 5);
  ctx.fillStyle = coat;
  ctx.fillRect(x, base - 13, 7, 9);
  ctx.fillStyle = '#f4c9a4';
  ctx.fillRect(x + 1, base - 18, 5, 5);
  ctx.fillStyle = hat;
  ctx.fillRect(x, base - 20, 7, 3);
}

/** Seaside station building: pastel walls, striped awning, clock, lamps, bench. */
export function paintStationBuilding(seed: number): HTMLCanvasElement {
  const p = makeCanvas(STATION_BUILDING.w * PX, STATION_BUILDING.h * PX);
  const { ctx, w, h } = p;
  const r = rng(seed);
  const body = pick(r, ['#ffe18f', '#f6b3a6', '#a9d8ec', '#c8e6ad']);
  const roof = pick(r, ['#d9714d', '#4f8fa6', '#c75b46']);
  const aw = pick(r, SUNNY.awning);
  const bx = 36;
  const bw = w - 72;
  const top = 40;
  const base = h;
  // building body
  ctx.fillStyle = body;
  ctx.fillRect(bx, top, bw, base - top);
  ctx.fillStyle = shade(body, -0.15);
  ctx.fillRect(bx + bw - 14, top, 14, base - top);
  // roof with gable and clock
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(bx - 8, top + 2);
  ctx.lineTo(bx + bw / 2, 8);
  ctx.lineTo(bx + bw + 8, top + 2);
  ctx.fill();
  ctx.fillStyle = shade(roof, -0.25);
  ctx.fillRect(bx - 8, top, bw + 16, 4);
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(bx + bw / 2, 26, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9c7430';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#34474c';
  ctx.fillRect(bx + bw / 2 - 0.5, 20, 1.5, 6);
  ctx.fillRect(bx + bw / 2, 25.5, 5, 1.5);
  // windows and door
  for (let i = 0; i < 4; i++) {
    const wx = bx + 14 + i * ((bw - 40) / 3);
    if (i === 2) {
      ctx.fillStyle = '#6e4a30';
      ctx.fillRect(wx - 2, base - 38, 16, 38);
      ctx.fillStyle = '#9a6a45';
      ctx.fillRect(wx, base - 36, 12, 36);
      continue;
    }
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(wx - 2, top + 14, 16, 22);
    ctx.fillStyle = SUNNY.window;
    ctx.fillRect(wx, top + 16, 12, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(wx, top + 16, 12, 5);
  }
  // sign board (blank: names come from UI later)
  ctx.fillStyle = '#2f5d62';
  ctx.fillRect(bx + bw / 2 - 30, top + 2, 60, 12);
  ctx.fillStyle = '#d9ac4c';
  ctx.fillRect(bx + bw / 2 - 30, top + 2, 60, 2);
  ctx.fillRect(bx + bw / 2 - 30, top + 12, 60, 2);
  ctx.fillStyle = '#ffb14a';
  ctx.fillRect(bx + bw / 2 - 6, top + 6, 10, 4); // little fish emblem
  ctx.fillRect(bx + bw / 2 + 4, top + 5, 3, 6);
  // striped awning across the platform
  const ay = base - 52;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? '#fffaf0' : aw;
    const sx = bx - 20 + (i * (bw + 40)) / 16;
    ctx.fillRect(sx, ay, (bw + 40) / 16 + 0.5, 10);
    ctx.beginPath();
    ctx.arc(sx + (bw + 40) / 32, ay + 10, (bw + 40) / 32, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(40,30,40,0.18)';
  ctx.fillRect(bx - 20, ay + 14, bw + 40, 6);
  // lamps at both ends
  for (const lx of [14, w - 18]) {
    ctx.fillStyle = '#34474c';
    ctx.fillRect(lx + 1, base - 70, 3, 70);
    ctx.fillRect(lx - 2, base - 4, 9, 4);
    ctx.fillStyle = '#d9ac4c';
    ctx.fillRect(lx - 3, base - 80, 11, 3);
    ctx.fillStyle = '#fff1b8';
    ctx.fillRect(lx - 1, base - 77, 7, 8);
  }
  // bench + passengers
  ctx.fillStyle = '#6e4a30';
  ctx.fillRect(bx + 4, base - 10, 26, 3);
  ctx.fillRect(bx + 6, base - 7, 2, 7);
  ctx.fillRect(bx + 26, base - 7, 2, 7);
  person(ctx, bx + 10, base - 6, '#e46a5c', '#3d6f8f');
  person(ctx, bx + bw - 36, base, '#4f8fa6', '#f2d16b');
  person(ctx, bx + bw - 26, base, '#f2a33c', '#e8e2d4');
  // potted plants
  for (const px of [bx - 14, bx + bw + 6]) {
    ctx.fillStyle = '#d9714d';
    ctx.fillRect(px, base - 8, 9, 8);
    ctx.fillStyle = SUNNY.leaf;
    ctx.beginPath();
    ctx.arc(px + 4.5, base - 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SUNNY.flowers[0];
    ctx.fillRect(px + 2, base - 16, 2, 2);
    ctx.fillRect(px + 6, base - 12, 2, 2);
  }
  return p.canvas;
}

/** Platform front face: cream concrete edge with a yellow safety line. 13 × 0.4 units. */
export function paintPlatformFace(): HTMLCanvasElement {
  const p = makeCanvas(13 * PX, Math.round(0.4 * PX));
  const { ctx, w, h } = p;
  ctx.fillStyle = '#e9dcc0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f5c84a';
  ctx.fillRect(0, 0, w, 2);
  ctx.fillStyle = '#cdbd9c';
  for (let x = 0; x < w; x += 24) ctx.fillRect(x, 3, 1, h - 3);
  ctx.fillStyle = 'rgba(60,50,60,0.25)';
  ctx.fillRect(0, h - 3, w, 3);
  return p.canvas;
}

/** Platform top seen from above: paving slabs. 13 × 1 units. */
export function paintPlatformTop(): HTMLCanvasElement {
  const p = makeCanvas(13 * PX, PX);
  const { ctx, w, h } = p;
  ctx.fillStyle = '#efe3c9';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d8c9a8';
  for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
  for (let y = 0; y < h; y += 10) ctx.fillRect(0, y, w, 1);
  ctx.fillStyle = '#f5c84a';
  ctx.fillRect(0, h - 4, w, 3);
  return p.canvas;
}
