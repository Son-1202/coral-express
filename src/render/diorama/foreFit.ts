/**
 * T-32: pure layout math for the painted foreground/track band (no DOM, no Three),
 * so it can be unit-tested. Render layout only — no game balance lives here.
 */

/** Deterministic hash → [0,1) for (a, b, salt). Render-only placement (no sim RNG). */
export function hash01(a: number, b: number, salt = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface TileFit {
  /** Whole repeats of the image across one strip tile (≥ 1), so recycled strip tiles join seamlessly. */
  repeat: number;
  /** World width of one image repeat. */
  tileW: number;
  /** World height the image gets at that width (keeps its aspect up to the integer rounding). */
  tileH: number;
}

/**
 * Fit a horizontally tileable image onto a strip `stripW` wide so that one image
 * repeat is about `targetH` tall at its natural aspect; the repeat count is
 * rounded to an integer (≥ 1) so the strip itself still tiles seamlessly.
 */
export function fitRepeat(stripW: number, imgW: number, imgH: number, targetH: number): TileFit {
  const aspect = imgW > 0 && imgH > 0 ? imgW / imgH : 1;
  const natural = Math.max(1e-6, targetH * aspect);
  const repeat = Math.max(1, Math.round(stripW / natural));
  const tileW = stripW / repeat;
  return { repeat, tileW, tileH: tileW / aspect };
}

/**
 * Bottom Y of a vertical image tile so that the row at `rowFrac` (0 = top,
 * 1 = bottom of the image) lands on world height `rowY`.
 */
export function anchorBottom(tileH: number, rowFrac: number, rowY: number): number {
  return rowY - (1 - rowFrac) * tileH;
}

export interface SlotSpec {
  /** Slot length along X (world units); each slot holds at most one sprite. */
  slot: number;
  /** Probability that a slot is filled. */
  chance: number;
  /** Depth range of the sprites. */
  zMin: number;
  zMax: number;
  /** Scale jitter: s ∈ [1 − jitter, 1 + jitter]. */
  jitter: number;
  salt: number;
}

export interface SlotPlacement {
  slotIndex: number;
  x: number;
  z: number;
  /** Which of the `kinds` sprites. */
  kind: number;
  scale: number;
  flip: boolean;
}

/**
 * Seeded, endless placement: slot k gets a sprite when hash(line, k) < chance;
 * position, depth, kind, scale and mirror all come from the same hash, so a given
 * stretch of track always shows the same dressing (stable across frames/loads).
 */
export function slotPlacements(line: number, spec: SlotSpec, x0: number, x1: number, kinds: number): SlotPlacement[] {
  const out: SlotPlacement[] = [];
  if (kinds <= 0 || spec.slot <= 0) return out;
  const k0 = Math.floor(x0 / spec.slot);
  const k1 = Math.ceil(x1 / spec.slot);
  for (let k = k0; k <= k1; k++) {
    const s = spec.salt;
    if (hash01(line, k, s) >= spec.chance) continue;
    out.push({
      slotIndex: k,
      x: (k + 0.15 + hash01(line, k, s + 1) * 0.7) * spec.slot,
      z: spec.zMin + hash01(line, k, s + 5) * (spec.zMax - spec.zMin),
      kind: Math.floor(hash01(line, k, s + 2) * kinds) % kinds,
      scale: 1 - spec.jitter + hash01(line, k, s + 3) * spec.jitter * 2,
      flip: hash01(line, k, s + 4) < 0.5,
    });
  }
  return out;
}

/**
 * Lowest world Y the camera can see on a vertical plane at depth `z`, for a camera
 * at (camY, camZ) tilted down `tiltDeg` with vertical field of view `fovDeg`.
 */
export function bottomVisibleY(camY: number, camZ: number, z: number, fovDeg: number, tiltDeg: number): number {
  const a = ((fovDeg / 2 + tiltDeg) * Math.PI) / 180;
  return camY - Math.tan(a) * (camZ - z);
}
