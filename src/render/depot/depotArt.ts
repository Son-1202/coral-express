/**
 * Pure pixel analysis for the T-34 depot art (no DOM / Three — unit-tested on synthetic images).
 * The shed's dark doorway and the pool's water band are found from the pixels, so the scene
 * can put the train *into* the doorway and the fish *into* the water whatever the exact framing
 * of the generated art is.
 */

/** Pixel rectangle, y down from the image top. */
export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Region {
  rect: PxRect;
  /** 1 for every pixel of the region (row-major, width × height). */
  mask: Uint8Array;
  count: number;
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Largest 4-connected component of `hit` (optionally only components whose bbox passes `keep`). */
export function largestRegion(w: number, h: number, hit: Uint8Array, keep?: (r: PxRect, count: number) => boolean): Region | null {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let best: Region | null = null;
  for (let start = 0; start < w * h; start++) {
    if (!hit[start] || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    const members: number[] = [];
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    while (sp > 0) {
      const i = stack[--sp]!;
      members.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const n of nb) {
        if (n >= 0 && hit[n] && !seen[n]) {
          seen[n] = 1;
          stack[sp++] = n;
        }
      }
    }
    const rect = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    if (keep && !keep(rect, members.length)) continue;
    if (!best || members.length > best.count) {
      const mask = new Uint8Array(w * h);
      for (const m of members) mask[m] = 1;
      best = { rect, mask, count: members.length };
    }
  }
  return best;
}

/**
 * The shed doorway: the biggest dark, opaque blob whose bottom reaches the lower part of the
 * sprite and that is taller than it is thin. Returned mask is "filled" per column from the
 * blob's top down to its bottom row, so lamps / rails painted inside the opening are punched too.
 */
export function findDoorway(img: Rgba, darkLum = 72): Region | null {
  const { data, width: w, height: h } = img;
  const hit = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3]!;
    if (a < 200) continue;
    if (lum(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!) < darkLum) hit[i] = 1;
  }
  // erode first: the baked 1 px dark outline links every dark detail of the sprite into one
  // network; the doorway is the only big *solid* dark area
  const core = erode(w, h, hit, 2);
  const reg = largestRegion(w, h, core, (r, n) => r.y + r.h >= h * 0.7 && r.w >= w * 0.1 && r.h >= h * 0.15 && n >= r.w * r.h * 0.35);
  if (!reg) return null;
  // grow back by the erosion radius (+1 for the arch's own outline)
  const g = 3;
  const x = Math.max(0, reg.rect.x - g);
  const y = Math.max(0, reg.rect.y - g);
  const rw = Math.min(w - x, reg.rect.w + 2 * g);
  const bottom = Math.min(h - 1, reg.rect.y + reg.rect.h - 1 + g);
  const grown = dilate(w, h, reg.mask, g);
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let cx = x; cx < x + rw; cx++) {
    let top = -1;
    for (let cy = y; cy <= bottom; cy++) if (grown[cy * w + cx] && hit[cy * w + cx]) { top = cy; break; }
    if (top < 0) continue;
    for (let cy = top; cy <= bottom; cy++) {
      mask[cy * w + cx] = 1;
      count++;
    }
  }
  const rect = { x, y, w: rw, h: bottom - y + 1 };
  return { rect, mask, count };
}

/** Sea-water colour test: opaque, blue/green dominant over red, not too dark or grey. */
export function isWater(r: number, g: number, b: number, a: number): boolean {
  if (a < 200) return false;
  const mx = Math.max(g, b);
  return mx - r > 28 && b > r + 12 && mx > 70 && mx - Math.min(r, g, b) > 34;
}

export interface WaterBand {
  /** Whole water region (mask + bbox). */
  region: Region;
  /** Inner rectangle that is (almost) all water — fish swim inside it. */
  inner: PxRect;
}

/**
 * The pool's water: the biggest water-coloured blob; `inner` is the band of rows and columns
 * (inside its bbox) whose columns are at least `fill` water, so a sprite kept inside it is in the water.
 */
export function findWater(img: Rgba, fill = 0.97): WaterBand | null {
  const { data, width: w, height: h } = img;
  const hit = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (isWater(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!, data[i * 4 + 3]!)) hit[i] = 1;
  // close small gaps (lily pads, sparkles) so the pond is one region
  const closed = dilate(w, h, hit, 2);
  const reg = largestRegion(w, h, closed, (r) => r.w >= w * 0.2 && r.h >= h * 0.06);
  if (!reg) return null;
  const { x, y, w: rw, h: rh } = reg.rect;
  // lily pads / kelp floating on the water are holes in the water mask: fill them (fish swim under)
  const wet = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) wet[i] = reg.mask[i]! & hit[i]!;
  // morphological closing bridges caustic highlight lines that touch the rim
  const solid = fillHoles(w, h, erode(w, h, dilate(w, h, wet, 3), 3));
  const isW = (cx: number, cy: number) => solid[cy * w + cx] === 1;
  const rowFill: number[] = [];
  for (let cy = y; cy < y + rh; cy++) {
    let n = 0;
    for (let cx = x; cx < x + rw; cx++) n += isW(cx, cy) ? 1 : 0;
    rowFill.push(n / rw);
  }
  let peak = 0;
  rowFill.forEach((f, i) => {
    if (f > rowFill[peak]!) peak = i;
  });
  // largest (almost) all-water rectangle: try row bands of decreasing height around the widest
  // row, keep the columns that are water in ≥ `fill` of the band, maximise the area
  let best: PxRect | null = null;
  for (let thr = 0.3; thr <= 0.96; thr += 0.04) {
    let a = peak;
    let b = peak;
    while (a > 0 && rowFill[a - 1]! >= thr) a--;
    while (b < rh - 1 && rowFill[b + 1]! >= thr) b++;
    const ry0 = y + a;
    const ry1 = y + b;
    const bandH = ry1 - ry0 + 1;
    if (bandH < 3) continue;
    const colOk = (cx: number) => {
      let n = 0;
      for (let cy = ry0; cy <= ry1; cy++) n += isW(cx, cy) ? 1 : 0;
      return n >= bandH * fill;
    };
    // widest run of good columns
    let runX = -1;
    let runW = 0;
    for (let cx = x, s0 = -1; cx <= x + rw; cx++) {
      if (cx < x + rw && colOk(cx)) {
        if (s0 < 0) s0 = cx;
      } else if (s0 >= 0) {
        if (cx - s0 > runW) {
          runW = cx - s0;
          runX = s0;
        }
        s0 = -1;
      }
    }
    if (runW < 3) continue;
    if (!best || runW * bandH > best.w * best.h) best = { x: runX, y: ry0, w: runW, h: bandH };
  }
  if (!best) return null;
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let i = 0; i < w * h; i++)
    if (reg.mask[i] && hit[i]) {
      mask[i] = 1;
      count++;
    }
  return { region: { rect: reg.rect, mask, count }, inner: best };
}

/** Mask with every enclosed hole filled (pixels not reachable from the border through non-mask). */
function fillHoles(w: number, h: number, m: Uint8Array): Uint8Array {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!m[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

function erode(w: number, h: number, m: Uint8Array, r: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = r; y < h - r; y++)
    for (let x = r; x < w - r; x++) {
      let ok = 1;
      for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r; dx++) if (!m[(y + dy) * w + x + dx]) { ok = 0; break; }
      out[y * w + x] = ok;
    }
  return out;
}

function dilate(w: number, h: number, m: Uint8Array, r: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = 1;
        }
    }
  return out;
}

/** Opaque bounding box (alpha ≥ 128) — keyed sprites carry transparent margins. */
export function opaqueBox(img: Rgba): PxRect {
  const { data, width: w, height: h } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3]! >= 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Rail-car layout on the siding: centre X of each rolled car, rearmost (k = 0) against the buffer. */
export function sidingSlots(bufferFaceX: number, carW: number, gap: number, n: number): number[] {
  return Array.from({ length: n }, (_, k) => bufferFaceX + carW / 2 + 0.04 + k * (carW + gap));
}
