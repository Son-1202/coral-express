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
  const reg = largestRegion(w, h, hit, (r, n) => r.y + r.h >= h * 0.7 && r.w >= w * 0.12 && r.h >= h * 0.18 && n >= r.w * r.h * 0.35);
  if (!reg) return null;
  const { x, y, w: rw, h: rh } = reg.rect;
  const bottom = y + rh - 1;
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let cx = x; cx < x + rw; cx++) {
    let top = -1;
    for (let cy = y; cy <= bottom; cy++) if (reg.mask[cy * w + cx]) { top = cy; break; }
    if (top < 0) continue;
    for (let cy = top; cy <= bottom; cy++) {
      mask[cy * w + cx] = 1;
      count++;
    }
  }
  return { rect: reg.rect, mask, count };
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
 * (inside its bbox) that are at least `fill` water, so a sprite kept inside it is in the water.
 */
export function findWater(img: Rgba, fill = 0.72): WaterBand | null {
  const { data, width: w, height: h } = img;
  const hit = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (isWater(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!, data[i * 4 + 3]!)) hit[i] = 1;
  // close small gaps (lily pads, sparkles) so the pond is one region
  const closed = dilate(w, h, hit, 2);
  const reg = largestRegion(w, h, closed, (r) => r.w >= w * 0.2 && r.h >= h * 0.06);
  if (!reg) return null;
  const { x, y, w: rw, h: rh } = reg.rect;
  // rows that are mostly water across the middle 60 % of the bbox
  const cx0 = x + Math.floor(rw * 0.2);
  const cx1 = x + Math.ceil(rw * 0.8);
  const rows: number[] = [];
  for (let cy = y; cy < y + rh; cy++) {
    let n = 0;
    for (let cx = cx0; cx < cx1; cx++) n += reg.mask[cy * w + cx]! & hit[cy * w + cx]! ? 1 : 0;
    if (n >= (cx1 - cx0) * fill) rows.push(cy);
  }
  if (rows.length < 3) return null;
  const ry0 = rows[0]!;
  const ry1 = rows[rows.length - 1]!;
  let ix0 = -1;
  let ix1 = -1;
  for (let cx = x; cx < x + rw; cx++) {
    let n = 0;
    for (let cy = ry0; cy <= ry1; cy++) n += hit[cy * w + cx] ? 1 : 0;
    if (n >= (ry1 - ry0 + 1) * fill) {
      if (ix0 < 0) ix0 = cx;
      ix1 = cx;
    }
  }
  if (ix0 < 0) return null;
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let i = 0; i < w * h; i++)
    if (reg.mask[i] && hit[i]) {
      mask[i] = 1;
      count++;
    }
  return { region: { rect: reg.rect, mask, count }, inner: { x: ix0, y: ry0, w: ix1 - ix0 + 1, h: ry1 - ry0 + 1 } };
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
