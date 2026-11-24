/**
 * Pure RGBA image operations for the sprite pipeline (no sharp, no I/O).
 * All functions are deterministic.
 */
import type { SizeMode } from './groups';

export interface Rgba {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, straight (non-premultiplied) alpha. */
  data: Uint8Array;
}

export const OUTLINE_BASE: readonly [number, number, number] = [0x1d, 0x1a, 0x2a];

export function createImage(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Bounding box of pixels with alpha > `minAlpha`. Null if fully transparent. */
export function opaqueBounds(img: Rgba, minAlpha = 8): { x: number; y: number; w: number; h: number } | null {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > minAlpha) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function crop(img: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = createImage(w, h);
  for (let r = 0; r < h; r++) {
    const src = ((y + r) * img.width + x) * 4;
    out.data.set(img.data.subarray(src, src + w * 4), r * w * 4);
  }
  return out;
}

/** Trim transparent borders (alpha ≤ minAlpha). */
export function trim(img: Rgba, minAlpha = 8): Rgba {
  const b = opaqueBounds(img, minAlpha);
  if (!b) return createImage(1, 1);
  return crop(img, b.x, b.y, b.w, b.h);
}

/** Output dimensions for a content box so the measured side equals `size` (never upscales). */
export function fitSize(w: number, h: number, size: number, mode: SizeMode): { width: number; height: number } {
  const measured = mode === 'width' ? w : mode === 'height' ? h : Math.max(w, h);
  const scale = Math.min(1, size / measured);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Exact area-averaging downscale (box filter with fractional coverage), alpha-weighted
 * so transparent pixels don't bleed their (often garbage) colour into edges.
 */
export function areaResize(img: Rgba, outW: number, outH: number): Rgba {
  const out = createImage(outW, outH);
  const sx = img.width / outW, sy = img.height / outH;
  for (let oy = 0; oy < outH; oy++) {
    const fy0 = oy * sy, fy1 = fy0 + sy;
    const iy0 = Math.floor(fy0), iy1 = Math.min(img.height, Math.ceil(fy1));
    for (let ox = 0; ox < outW; ox++) {
      const fx0 = ox * sx, fx1 = fx0 + sx;
      const ix0 = Math.floor(fx0), ix1 = Math.min(img.width, Math.ceil(fx1));
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let y = iy0; y < iy1; y++) {
        const wy = Math.min(fy1, y + 1) - Math.max(fy0, y);
        for (let x = ix0; x < ix1; x++) {
          const w = wy * (Math.min(fx1, x + 1) - Math.max(fx0, x));
          const i = (y * img.width + x) * 4;
          const al = img.data[i + 3] * w;
          r += img.data[i] * al;
          g += img.data[i + 1] * al;
          b += img.data[i + 2] * al;
          a += al;
          area += w;
        }
      }
      const o = (oy * outW + ox) * 4;
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
      }
      out.data[o + 3] = area > 0 ? Math.round(a / area) : 0;
    }
  }
  return out;
}

/** Binary alpha: α < threshold → fully transparent (RGB zeroed), else fully opaque. */
export function thresholdAlpha(img: Rgba, threshold = 128): Rgba {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < threshold) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
    else d[i + 3] = 255;
  }
  return img;
}

interface Box { colors: number[]; counts: number[] }

/**
 * Median-cut palette quantization over opaque pixels (transparency kept).
 * Returns the palette used, as packed 0xRRGGBB numbers.
 */
export function quantize(img: Rgba, maxColors = 32): number[] {
  const hist = new Map<number, number>();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    hist.set(c, (hist.get(c) ?? 0) + 1);
  }
  if (hist.size === 0) return [];
  const keys = [...hist.keys()].sort((p, q) => p - q);
  let boxes: Box[] = [{ colors: keys, counts: keys.map((k) => hist.get(k) ?? 0) }];

  const chan = (c: number, ch: number) => (c >> (16 - ch * 8)) & 255;
  const range = (box: Box) => {
    let best = 0, bestCh = 0;
    for (let ch = 0; ch < 3; ch++) {
      let lo = 255, hi = 0;
      for (const c of box.colors) { const v = chan(c, ch); if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo > best) { best = hi - lo; bestCh = ch; }
    }
    return { spread: best, ch: bestCh };
  };

  while (boxes.length < maxColors) {
    // Split the box with the largest (spread × population); ties broken by index for determinism.
    let pick = -1, pickScore = 0, pickCh = 0;
    boxes.forEach((box, i) => {
      if (box.colors.length < 2) return;
      const { spread, ch } = range(box);
      const pop = box.counts.reduce((s, n) => s + n, 0);
      const score = spread * Math.sqrt(pop);
      if (score > pickScore) { pickScore = score; pick = i; pickCh = ch; }
    });
    if (pick < 0) break;
    const box = boxes[pick];
    const order = box.colors.map((_c, i) => i).sort((p, q) => chan(box.colors[p], pickCh) - chan(box.colors[q], pickCh) || box.colors[p] - box.colors[q]);
    const total = box.counts.reduce((s, n) => s + n, 0);
    let acc = 0, cut = 1;
    for (let k = 0; k < order.length - 1; k++) {
      acc += box.counts[order[k]];
      if (acc >= total / 2) { cut = k + 1; break; }
      cut = k + 1;
    }
    const a = order.slice(0, cut), b = order.slice(cut);
    boxes = [
      ...boxes.slice(0, pick),
      { colors: a.map((i) => box.colors[i]), counts: a.map((i) => box.counts[i]) },
      { colors: b.map((i) => box.colors[i]), counts: b.map((i) => box.counts[i]) },
      ...boxes.slice(pick + 1),
    ];
  }

  const palette: number[] = [];
  const lookup = new Map<number, number>();
  for (const box of boxes) {
    let r = 0, g = 0, b = 0, n = 0;
    box.colors.forEach((c, i) => { const w = box.counts[i]; r += chan(c, 0) * w; g += chan(c, 1) * w; b += chan(c, 2) * w; n += w; });
    const p = (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
    palette.push(p);
    for (const c of box.colors) lookup.set(c, p);
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const p = lookup.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) ?? 0;
    d[i] = (p >> 16) & 255; d[i + 1] = (p >> 8) & 255; d[i + 2] = p & 255;
  }
  return [...new Set(palette)];
}

/** Add `pad` transparent pixels on every side. */
export function pad(img: Rgba, padPx: number): Rgba {
  const out = createImage(img.width + padPx * 2, img.height + padPx * 2);
  for (let y = 0; y < img.height; y++) {
    out.data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), ((y + padPx) * out.width + padPx) * 4);
  }
  return out;
}

/**
 * 1 px outline (4-connected) around the opaque silhouette: each transparent pixel touching
 * an opaque one gets the darkened average of its opaque neighbours mixed toward #1d1a2a.
 * Expects binary alpha. Image should already have ≥1 px transparent padding.
 */
export function outline(img: Rgba, darken = 0.35, baseMix = 0.5): Rgba {
  const { width: w, height: h, data: d } = img;
  const src = new Uint8Array(d);
  const isOpaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] === 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isOpaque(x, y)) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!isOpaque(x + dx, y + dy)) continue;
        const i = ((y + dy) * w + x + dx) * 4;
        r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
      }
      if (n === 0) continue;
      const o = (y * w + x) * 4;
      const mix = (v: number, base: number) => Math.round((v / n) * darken * (1 - baseMix) + base * baseMix);
      d[o] = mix(r, OUTLINE_BASE[0]);
      d[o + 1] = mix(g, OUTLINE_BASE[1]);
      d[o + 2] = mix(b, OUTLINE_BASE[2]);
      d[o + 3] = 255;
    }
  }
  return img;
}

export interface PixelizeOptions {
  size: number;
  mode: SizeMode;
  colors?: number;
}

/** Full sprite pipeline: trim → area downscale → alpha threshold → quantize → outline. */
export function pixelizeImage(src: Rgba, opts: PixelizeOptions): { image: Rgba; colors: number } {
  // Trim at the threshold so soft halos don't count toward the sprite's size.
  const trimmed = trim(src, 127);
  // Reserve 1 px on each side for the outline so the final measured side equals `size`.
  const { width, height } = fitSize(trimmed.width, trimmed.height, Math.max(1, opts.size - 2), opts.mode);
  const small = trim(thresholdAlpha(areaResize(trimmed, width, height)), 0);
  const palette = quantize(small, opts.colors ?? 32);
  const image = outline(pad(small, 1));
  return { image, colors: palette.length };
}
