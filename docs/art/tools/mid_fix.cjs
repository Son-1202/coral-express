// Mid layer (l1_mid) cutout: AI alpha kept the houses but dropped lemon trees + cliff band.
// Rebuild: rows < cliffTop -> alpha = AI alpha OR saturated (trees/lemons/roofs, not the grey ghost bleed);
// rows cliffTop..cliffBottom -> opaque; rows below cliffBottom (track/fence bleed) -> cut.
// usage: node docs/art/tools/mid_fix.cjs <raw.png> <ai_nobg.png> <out.png> cliffTop cliffBottom [satThr=0.3]
const sharp = require('sharp');
const [,, raw, ai, out, ct, cb, st] = process.argv;
const CT = +ct, CB = +cb, ST = +(st || 0.3);
(async () => {
  const { data, info } = await sharp(raw).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const A = (await sharp(ai).ensureAlpha().resize(info.width, info.height).raw().toBuffer());
  const W = info.width, H = CB + 1;
  let m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, i = k * 3;
    if (y >= CT) { m[k] = 1; continue; }
    const r = data[i], g = data[i + 1], b = data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    if (A[k * 4 + 3] > 100 || (sat > ST && mx > 50)) m[k] = 1;
  }
  // 2 passes of 5x5 majority filter to drop specks / fill pinholes
  for (let p = 0; p < 2; p++) {
    const n = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = 0, t = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue; t++; c += m[yy * W + xx]; }
      n[y * W + x] = y >= CT ? 1 : (c * 2 > t ? 1 : 0);
    }
    m = n;
  }
  const o = Buffer.alloc(W * H * 4);
  for (let k = 0; k < W * H; k++) { o[k * 4] = data[k * 3]; o[k * 4 + 1] = data[k * 3 + 1]; o[k * 4 + 2] = data[k * 3 + 2]; o[k * 4 + 3] = m[k] ? 255 : 0; }
  const t = await sharp(o, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const tr = await sharp(t).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const r = await sharp(tr.data).resize({ width: Math.min(2752, tr.info.width) }).png().toFile(out);
  console.log(out, r.width + 'x' + r.height);
})();
