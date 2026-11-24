// Shared grey-background keyer. keyRGB(data(RGB raw), W, H, {tol, sat, minHole, bg}) -> RGBA Buffer
// bg = median of the border pixels unless given. Border-connected bg-like pixels are cleared,
// plus enclosed bg-like pockets >= minHole px. 1px soft fringe on bg-like edge pixels.
function keyRGB(data, W, H, o = {}) {
  const tol = o.tol ?? 22, satMax = o.sat ?? 14, minHole = o.minHole ?? 400, N = W * H;
  let bg = o.bg;
  if (!bg) { const rs = [], gs = [], bs = [];
    const push = i => { rs.push(data[i*3]); gs.push(data[i*3+1]); bs.push(data[i*3+2]); };
    for (let x = 0; x < W; x++) { push(x); push((H-1)*W + x); }
    for (let y = 0; y < H; y++) { push(y*W); push(y*W + W-1); }
    const med = a => a.sort((p, q) => p - q)[a.length >> 1]; bg = [med(rs), med(gs), med(bs)]; }
  const isBg = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const r = data[i*3], g = data[i*3+1], b = data[i*3+2];
    const d = Math.max(Math.abs(r-bg[0]), Math.abs(g-bg[1]), Math.abs(b-bg[2]));
    isBg[i] = (d <= tol && Math.max(r,g,b) - Math.min(r,g,b) <= satMax) ? 1 : 0; }
  const clear = new Uint8Array(N), seen = new Uint8Array(N), stack = new Int32Array(N);
  for (let s = 0; s < N; s++) { if (!isBg[s] || seen[s]) continue;
    let sp = 0, border = false; const comp = []; stack[sp++] = s; seen[s] = 1;
    while (sp) { const p = stack[--sp]; comp.push(p); const x = p % W, y = (p / W) | 0;
      if (x === 0 || y === 0 || x === W-1 || y === H-1) border = true;
      if (x > 0 && !seen[p-1] && isBg[p-1]) { seen[p-1] = 1; stack[sp++] = p-1; }
      if (x < W-1 && !seen[p+1] && isBg[p+1]) { seen[p+1] = 1; stack[sp++] = p+1; }
      if (y > 0 && !seen[p-W] && isBg[p-W]) { seen[p-W] = 1; stack[sp++] = p-W; }
      if (y < H-1 && !seen[p+W] && isBg[p+W]) { seen[p+W] = 1; stack[sp++] = p+W; } }
    if (border || comp.length >= minHole) for (const p of comp) clear[p] = 1; }
  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) { out[i*4] = data[i*3]; out[i*4+1] = data[i*3+1]; out[i*4+2] = data[i*3+2];
    let a = clear[i] ? 0 : 255;
    if (!clear[i] && isBg[i]) { const x = i % W, y = (i / W) | 0; let n = 0;
      if (x>0&&clear[i-1]) n++; if (x<W-1&&clear[i+1]) n++; if (y>0&&clear[i-W]) n++; if (y<H-1&&clear[i+W]) n++;
      a = n >= 2 ? 0 : n === 1 ? 128 : 255; }
    out[i*4+3] = a; }
  return { rgba: out, bg };
}
// bounding box of alpha > 0
function bbox(rgba, W, H) { let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rgba[(y*W+x)*4+3]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1-x0+1, height: y1-y0+1 }; }
module.exports = { keyRGB, bbox };
