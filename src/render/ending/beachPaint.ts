/**
 * Ending beach ground + sea, painted in the Line 3 (Volcano Isles) palette: warm black volcanic
 * sand with a dusk rim light, dunes, basalt pebbles and glints, a wet glossy shore that slopes
 * into the sea (animated swash + foam line), and a foreground wash at the bottom of the frame.
 * World units: 1 = canvas height, y down. Deterministic (hash per world cell) so it scrolls cleanly.
 */
export const BEACH_Y = 0.7; // rail height on the beach
export const SEA_Y = 0.74; // water surface
export const SLOPE_X = 1.9; // rails/sand start descending here
export const K = 0.32; // slope (dy/dx)

/** Rail height at world x (soft knee into the slope; matches beach.ts `railAt`). */
export function railY(x: number): number {
  if (x <= SLOPE_X) return BEACH_Y;
  const dx = x - SLOPE_X;
  const d = dx * Math.sqrt(1 + K * K);
  const u = Math.min(1, d / 0.25);
  return BEACH_Y + dx * K * u * u * (3 - 2 * u);
}

/** Where the sand surface meets the sea surface (bisection on the monotonic slope). */
export const SHORE_X = (() => {
  let lo = SLOPE_X;
  let hi = SLOPE_X + 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (railY(m) + 0.02 < SEA_Y) lo = m;
    else hi = m;
  }
  return lo;
})();

const L3 = {
  sandTop: '#4b3c3f',
  sandMid: '#2f272c',
  sandDeep: '#1b171c',
  rim: 'rgba(255,176,120,0.55)',
  glow: 'rgba(255,150,100,0.20)',
  dune: 'rgba(132,104,104,0.16)',
  duneShade: 'rgba(8,6,10,0.28)',
  pebble: '#19161b',
  pebbleLit: '#5d4d53',
  glint: 'rgba(255,196,140,0.55)',
  grain: 'rgba(205,184,176,0.16)',
  foam: 'rgba(255,240,222,0.9)',
};

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Sand surface height at world x (gentle undulation on the flat, a soft knee into the slope). */
export function sandTop(x: number): number {
  const und = Math.sin(x * 7.3) * 0.004 + Math.sin(x * 17.1 + 1.3) * 0.002;
  const fade = x <= SLOPE_X ? 1 : Math.max(0, 1 - (x - SLOPE_X) / 0.15);
  return railY(x) + 0.02 + und * fade;
}

const wave = (x: number, t: number) => SEA_Y + Math.sin(x * 22 + t * 2.2) * 0.004 + Math.sin(x * 9 - t * 1.3) * 0.003;

export function paintSand(g: CanvasRenderingContext2D, camX: number, aspect: number, t: number): void {
  const xL = camX - 0.4;
  const xR = camX + aspect + 0.4;
  // body
  const grad = g.createLinearGradient(0, BEACH_Y, 0, BEACH_Y + 0.5);
  grad.addColorStop(0, L3.sandTop);
  grad.addColorStop(0.35, L3.sandMid);
  grad.addColorStop(1, L3.sandDeep);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(xL, sandTop(xL));
  for (let x = xL; x <= xR; x += 0.01) g.lineTo(x, sandTop(x));
  g.lineTo(xR, 9);
  g.lineTo(xL, 9);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  // dusk glow band under the lip
  const glow = g.createLinearGradient(0, BEACH_Y + 0.015, 0, BEACH_Y + 0.07);
  glow.addColorStop(0, L3.glow);
  glow.addColorStop(1, 'rgba(255,150,100,0)');
  g.fillStyle = glow;
  g.fillRect(xL, BEACH_Y, xR - xL, 0.08);
  // dunes (two depth rows: far = flatter, lighter; near = bigger, with a shadow)
  for (let row = 0; row < 2; row++) {
    const cell = row ? 0.42 : 0.3;
    for (let c = Math.floor(xL / cell); c * cell < xR; c++) {
      const r = hash(c * 3.1 + row * 17);
      const x = c * cell + r * cell * 0.6;
      const y = BEACH_Y + (row ? 0.15 : 0.06) + hash(c + row * 5.3) * 0.05;
      const rx = cell * (0.5 + r * 0.4);
      const ry = row ? 0.03 : 0.016;
      g.fillStyle = L3.duneShade;
      g.beginPath();
      g.ellipse(x + 0.01, y + ry * 0.6, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = L3.dune;
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, Math.PI, 0);
      g.fill();
    }
  }
  // basalt pebbles (bigger towards the viewer)
  const pc = 0.05;
  for (let c = Math.floor(xL / pc); c * pc < xR; c++) {
    const r = hash(c * 1.7 + 4);
    if (r > 0.5) continue;
    const depth = hash(c * 2.9 + 1);
    const x = c * pc + hash(c + 9.2) * pc;
    const y = BEACH_Y + 0.04 + depth * 0.27;
    const rad = 0.004 + depth * 0.009 + r * 0.006;
    g.fillStyle = L3.pebble;
    g.beginPath();
    g.ellipse(x, y, rad * 1.4, rad, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = L3.pebbleLit;
    g.fillRect(x - rad * 0.8, y - rad * 0.9, rad * 1.1, rad * 0.35);
    g.fillStyle = L3.glint;
    g.fillRect(x - rad * 0.9, y - rad, rad * 0.35, rad * 0.25);
  }
  // grains + sparkles (twinkle slowly)
  const gc = 0.014;
  for (let c = Math.floor(xL / gc); c * gc < xR; c++) {
    for (let k = 0; k < 3; k++) {
      const r = hash(c * 5.7 + k * 13.3);
      if (r > 0.35) continue;
      const x = c * gc + hash(c + k * 7.1) * gc;
      const y = BEACH_Y + 0.03 + hash(c * 0.37 + k * 3.7) * 0.3;
      if (r < 0.04) {
        g.fillStyle = `rgba(255,200,150,${(0.25 + 0.35 * Math.max(0, Math.sin(t * 1.5 + c))).toFixed(3)})`;
        g.fillRect(x, y, 0.003, 0.003);
      } else {
        g.fillStyle = L3.grain;
        g.fillRect(x, y, 0.0025, 0.0025);
      }
    }
  }
  // wet, glossy sand near the shore reflecting the dusk sky
  const wet = g.createLinearGradient(SHORE_X - 0.35, 0, SHORE_X, 0);
  wet.addColorStop(0, 'rgba(255,160,110,0)');
  wet.addColorStop(1, 'rgba(255,160,110,0.22)');
  g.fillStyle = wet;
  g.fillRect(SHORE_X - 0.35, BEACH_Y, 0.36 + 2, 0.5);
  g.restore();
  // rim light on the lip
  g.strokeStyle = L3.rim;
  g.lineWidth = 0.003;
  g.beginPath();
  const lipEnd = Math.min(xR, SHORE_X);
  g.moveTo(xL, sandTop(xL));
  for (let x = xL; x <= lipEnd; x += 0.01) g.lineTo(x, sandTop(x));
  g.stroke();
}

/** Painted Line 3 foreground: the basalt boulder row + dune foot cropped from `scenery/l3_mid`. */
const ROCKS_SRC = { y: 668, h: 88 };
const ROCKS_H = 0.14;
export function paintNearRocks(g: CanvasRenderingContext2D, img: HTMLImageElement | null, camX: number, aspect: number): void {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const sh = Math.min(ROCKS_SRC.h, img.naturalHeight - ROCKS_SRC.y);
  if (sh <= 0) return;
  const tw = (img.naturalWidth * ROCKS_H) / sh;
  const y = 0.875;
  // clip to the sand body: the boulders belong to the ground and slip under the sea with the slope
  const xL = camX - 0.3;
  const xR = camX + aspect + 0.3;
  g.save();
  g.beginPath();
  g.moveTo(xL, sandTop(xL));
  for (let x = xL; x <= xR; x += 0.01) g.lineTo(x, sandTop(x));
  g.lineTo(xR, 9);
  g.lineTo(xL, 9);
  g.closePath();
  g.clip();
  // foreground parallax: scrolls 25% faster than the rails (tile k sits at k·tw − 0.25·camX)
  g.imageSmoothingEnabled = true;
  for (let k = Math.floor((1.25 * camX - 0.1) / tw); k * tw - 0.25 * camX < xR; k++) {
    g.drawImage(img, 0, ROCKS_SRC.y, img.naturalWidth, sh, k * tw - 0.25 * camX, y, tw + 0.002, ROCKS_H);
  }
  g.imageSmoothingEnabled = false;
  // warm dusk rim on the boulder tops
  const rim = g.createLinearGradient(0, y, 0, y + 0.05);
  rim.addColorStop(0, 'rgba(255,150,100,0.10)');
  rim.addColorStop(1, 'rgba(255,150,100,0)');
  g.fillStyle = rim;
  g.fillRect(xL, y, xR - xL, 0.05);
  g.restore();
}

/**
 * The sea right of the shore. The water fills only the space between its surface and the sand
 * (so it meets the beach at a point, no vertical edge); the submerged slope gets a soft tint.
 */
export function paintSea(g: CanvasRenderingContext2D, camX: number, aspect: number, t: number): void {
  const x0 = Math.max(SHORE_X, camX - 0.3);
  const x1 = camX + aspect + 0.3;
  if (x1 <= x0) return;
  const step = 0.01;
  // submerged slope tint (fades in from the shore)
  const tint = g.createLinearGradient(SHORE_X, 0, SHORE_X + 0.4, 0);
  tint.addColorStop(0, 'rgba(24,96,118,0)');
  tint.addColorStop(1, 'rgba(24,96,118,0.5)');
  g.fillStyle = tint;
  g.beginPath();
  g.moveTo(x0, sandTop(x0));
  for (let x = x0; x <= x1; x += step) g.lineTo(x, sandTop(x));
  g.lineTo(x1, 9);
  g.lineTo(x0, 9);
  g.closePath();
  g.fill();
  // water body: surface → sand
  const grad = g.createLinearGradient(0, SEA_Y, 0, SEA_Y + 1.4);
  grad.addColorStop(0, 'rgba(214,150,120,0.5)');
  grad.addColorStop(0.06, 'rgba(70,160,170,0.6)');
  grad.addColorStop(0.35, 'rgba(25,105,135,0.8)');
  grad.addColorStop(1, 'rgba(8,40,70,0.94)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x0, Math.min(wave(x0, t), sandTop(x0)));
  for (let x = x0; x <= x1; x += step) g.lineTo(x, Math.min(wave(x, t), sandTop(x)));
  for (let x = x1; x >= x0; x -= step) g.lineTo(x, sandTop(x));
  g.closePath();
  g.fill();
  // light rays under the surface
  g.save();
  g.clip();
  g.fillStyle = 'rgba(255,230,200,0.06)';
  for (let i = 0; i < 6; i++) {
    const rx = Math.floor(camX) + i * 0.45 + Math.sin(t * 0.4 + i) * 0.05;
    g.beginPath();
    g.moveTo(rx, SEA_Y);
    g.lineTo(rx + 0.08, SEA_Y);
    g.lineTo(rx + 0.3, SEA_Y + 1.2);
    g.lineTo(rx + 0.12, SEA_Y + 1.2);
    g.fill();
  }
  g.restore();
  // surface highlight (warm, reflecting the dusk), fading in from the shore
  g.strokeStyle = 'rgba(255,226,190,0.8)';
  g.lineWidth = 0.003;
  g.beginPath();
  const s0 = Math.max(x0, SHORE_X + 0.03);
  g.moveTo(s0, wave(s0, t));
  for (let x = s0; x <= x1; x += 0.02) g.lineTo(x, wave(x, t));
  g.stroke();
  // swash: foam that runs up and down the slope
  const run = (Math.sin(t * 1.1) * 0.5 + 0.5) * 0.06;
  g.fillStyle = L3.foam;
  for (let i = 0; i < 8; i++) {
    const x = SHORE_X - run + i * 0.013;
    const y = Math.min(sandTop(x), wave(x, t)) - 0.002;
    g.globalAlpha = 0.85 - i * 0.09;
    g.fillRect(x, y, 0.011, 0.003);
  }
  g.globalAlpha = 1;
}
