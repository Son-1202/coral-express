// T-37 festival decor build: npx tsx docs/art/tools/t37_build.ts
// assets/_raw/t37/*.png -> keyed cuts in assets/_cut/festival/ -> pixel sprites in assets/festival/.
// Strips (bunting, lanterns): one colour cycle cut between gap centres (rope-only columns), seam columns
// cross-faded so tile(x=W-1) -> tile(x=0) is continuous; downscaled with areaResize (no trim/outline so
// the width stays exactly one period). Flag: project pixelizer. Confetti: sheet composed at a shared
// source scale, downscaled as a whole, then sliced into 8 cells and trimmed.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { pixelizeFile } from '../../../scripts/pixelize';
import { areaResize, thresholdAlpha, quantize, crop, trim, createImage, type Rgba } from '../../../scripts/lib/pixel';
const require = createRequire(import.meta.url);
const { keyRGB } = require('./t10_keylib.cjs');

const RAW = 'assets/_raw/t37', CUT = 'assets/_cut/festival', OUT = 'assets/festival';
mkdirSync(CUT, { recursive: true }); mkdirSync(OUT, { recursive: true });
const SCALE = 0.25; // source pixel chunk ~4 px -> 1 game px

async function keyed(name: string): Promise<Rgba> {
  const { data, info } = await sharp(`${RAW}/${name}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { rgba } = keyRGB(data, info.width, info.height, { tol: 20, sat: 14, minHole: 300 });
  return { width: info.width, height: info.height, data: new Uint8Array(rgba) };
}
const save = (img: Rgba, p: string) => sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } }).png().toFile(p);
const A = (img: Rgba, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

/** rope row = row with the most opaque pixels in the top half */
function ropeRow(img: Rgba, y0: number, y1: number): number {
  let best = -1, by = 0;
  for (let y = y0; y < y1; y++) { let n = 0; for (let x = 0; x < img.width; x++) if (A(img, x, y) > 127) n++; if (n > best) { best = n; by = y; } }
  return by;
}
/** centres of horizontal gaps (columns empty between yA..yB), interior only */
function gaps(img: Rgba, yA: number, yB: number): number[] {
  const empty = (x: number) => { for (let y = yA; y < yB; y++) if (A(img, x, y) > 127) return false; return true; };
  const out: number[] = []; let s = -1;
  for (let x = 0; x < img.width; x++) {
    if (empty(x)) { if (s < 0) s = x; } else if (s >= 0) { if (s > 0) out.push((s + x - 1) >> 1); s = -1; }
  }
  return out;
}
function bandBounds(img: Rgba): [number, number] {
  let t = img.height, b = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (A(img, x, y) > 127) { if (y < t) t = y; if (y > b) b = y; break; }
  return [t, b];
}
/** cross-fade the last B columns toward column 0's neighbourhood so the tile wraps cleanly */
function wrapFix(img: Rgba, B = 12): void {
  const W = img.width, d = img.data;
  for (let y = 0; y < img.height; y++) for (let k = 0; k < B; k++) {
    const x = W - B + k, t = (k + 1) / (B + 1), si = (y * W + k) * 4, di = (y * W + x) * 4;
    // target: content that will sit just left of column 0 = mirror of the start
    for (let c = 0; c < 4; c++) d[di + c] = Math.round(d[di + c] * (1 - t) + d[si + c] * t);
  }
}

async function strip(name: string, period: number, ropeSearch: [number, number]) {
  const img = await keyed(name);
  const ry = ropeRow(img, ropeSearch[0], ropeSearch[1]);
  const g = gaps(img, ry + 40, img.height);
  if (g.length < period + 1) throw new Error(`${name}: only ${g.length} gaps`);
  const x0 = g[0], x1 = g[period];
  const [top, bot] = bandBounds(img);
  const t = Math.max(0, top - 4), h = Math.min(img.height, bot + 6) - t;
  const cut = crop(img, x0, t, x1 - x0, h);
  wrapFix(cut);
  await save(cut, `${CUT}/${name}.png`);
  const w = Math.round(cut.width * SCALE), hh = Math.round(cut.height * SCALE);
  const small = thresholdAlpha(areaResize(cut, w, hh));
  const pal = quantize(small, 48);
  await save(small, `${OUT}/${name}.png`);
  console.log(name, 'rope y', ry, 'gaps', g.length, 'period px', x1 - x0, '->', `${w}x${hh}`, pal.length, 'colours');
}

async function confetti() {
  const img = await keyed('confetti');
  const cw = img.width / 4, ch = img.height / 2; const pieces: Rgba[] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++)
    pieces.push(trim(crop(img, Math.round(c * cw), Math.round(r * ch), Math.round(cw), Math.round(ch)), 127));
  pieces.forEach((p, i) => save(p, `${CUT}/confetti_${i + 1}.png`));
  const CELL = 32, SRC = CELL / SCALE; // 128 source px per cell
  const maxSide = Math.max(...pieces.map((p) => Math.max(p.width, p.height)));
  const fit = Math.min(1, (SRC - 16) / maxSide); // shared scale for all pieces
  const sheet = createImage(4 * CELL, 2 * CELL);
  for (let i = 0; i < 8; i++) {
    const p = pieces[i];
    const w = Math.max(2, Math.round(p.width * fit * SCALE)), h = Math.max(2, Math.round(p.height * fit * SCALE));
    const s = thresholdAlpha(areaResize(p, w, h));
    const ox = (i % 4) * CELL + ((CELL - w) >> 1), oy = Math.floor(i / 4) * CELL + ((CELL - h) >> 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++)
      sheet.data[((oy + y) * sheet.width + ox + x) * 4 + k] = s.data[(y * w + x) * 4 + k];
  }
  quantize(sheet, 32);
  await save(sheet, `${OUT}/confetti.png`);
  for (let i = 0; i < 8; i++) {
    const s = trim(crop(sheet, (i % 4) * CELL, Math.floor(i / 4) * CELL, CELL, CELL), 1);
    await save(s, `${OUT}/confetti_${i + 1}.png`);
  }
  console.log('confetti fit', fit.toFixed(3), 'sheet', `${sheet.width}x${sheet.height}`, 'cell', CELL);
}

async function flag() {
  const img = await keyed('flag');
  await save(trim(img, 127), `${CUT}/flag.png`);
  const r = await pixelizeFile(`${CUT}/flag.png`, `${OUT}/flag.png`, { kind: 'sprite', group: 'festival', size: 96, mode: 'height' }, 32);
  console.log('flag', r.src, '->', r.out, r.colors, 'colours');
}

await strip('bunting', 6, [0, 600]);   // 6 colours per cycle
await strip('lanterns', 4, [0, 600]);  // 4 colours per cycle
await confetti();
await flag();
