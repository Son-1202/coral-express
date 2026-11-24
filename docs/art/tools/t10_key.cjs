// Local grey-background keyer (free alternative to remove_background for scenery bands).
// usage: node docs/art/tools/t10_key.cjs <in.png> <out.png> [top] [height] [tol=22] [minHole=400]
// Crops rows [top, top+height), estimates the bg grey from the crop's top row, flood-fills from the
// borders through pixels within `tol` of that grey, also clears enclosed grey pockets >= minHole px,
// then trims transparent rows and feathers the alpha edge by one pixel.
const sharp = require('sharp');
const [,, inp, out, topA, hA, tolA, holeA] = process.argv;
(async () => {
  const meta = await sharp(inp).metadata();
  const top = +(topA || 0), h = +(hA || meta.height - top), tol = +(tolA || 22), minHole = +(holeA || 400);
  const { data, info } = await sharp(inp).extract({ left: 0, top, width: meta.width, height: h })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  // bg estimate: median of top row
  const rs = [], gs = [], bs = [];
  for (let x = 0; x < W; x++) { rs.push(data[x*3]); gs.push(data[x*3+1]); bs.push(data[x*3+2]); }
  const med = a => a.sort((p, q) => p - q)[a.length >> 1];
  const bg = [med(rs), med(gs), med(bs)];
  const isBg = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i*3], g = data[i*3+1], b = data[i*3+2];
    const d = Math.max(Math.abs(r-bg[0]), Math.abs(g-bg[1]), Math.abs(b-bg[2]));
    const sat = Math.max(r,g,b) - Math.min(r,g,b);
    isBg[i] = (d <= tol && sat <= 14) ? 1 : 0;
  }
  const clear = new Uint8Array(N), seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  const fill = (seed) => { // returns list of pixels in component
    let sp = 0; stack[sp++] = seed; seen[seed] = 1; const comp = [];
    while (sp) { const p = stack[--sp]; comp.push(p); const x = p % W, y = (p / W) | 0;
      const nb = [x>0?p-1:-1, x<W-1?p+1:-1, y>0?p-W:-1, y<H-1?p+W:-1];
      for (const q of nb) if (q >= 0 && !seen[q] && isBg[q]) { seen[q] = 1; stack[sp++] = q; } }
    return comp; };
  for (let i = 0; i < N; i++) if (isBg[i] && !seen[i]) {
    const x = i % W, y = (i / W) | 0; const border = x === 0 || y === 0 || x === W-1 || y === H-1;
    const comp = fill(i);
    // border-connected, or a big enclosed pocket
    if (border || comp.length >= minHole || comp.some(p => { const px=p%W, py=(p/W)|0; return px===0||py===0||px===W-1||py===H-1; }))
      for (const p of comp) clear[p] = 1;
  }
  const outBuf = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    outBuf[i*4] = data[i*3]; outBuf[i*4+1] = data[i*3+1]; outBuf[i*4+2] = data[i*3+2];
    let a = clear[i] ? 0 : 255;
    if (!clear[i]) { const x = i % W, y = (i / W) | 0; let n = 0;
      if (x>0&&clear[i-1]) n++; if (x<W-1&&clear[i+1]) n++; if (y>0&&clear[i-W]) n++; if (y<H-1&&clear[i+W]) n++;
      if (n >= 2 && isBg[i]) a = 0; else if (n >= 1 && isBg[i]) a = 128; }
    outBuf[i*4+3] = a;
  }
  // trim fully transparent rows top/bottom
  let y0 = 0, y1 = H - 1;
  const rowEmpty = y => { for (let x = 0; x < W; x++) if (outBuf[(y*W+x)*4+3]) return false; return true; };
  while (y0 < y1 && rowEmpty(y0)) y0++; while (y1 > y0 && rowEmpty(y1)) y1--;
  await sharp(outBuf, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: 0, top: y0, width: W, height: y1 - y0 + 1 }).png().toFile(out);
  console.log(out, W + 'x' + (y1 - y0 + 1), 'bg', bg.join(','));
})();
