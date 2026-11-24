// Seamless tiling for alpha bands: find columns xL (near left) and xR (near right) whose neighbourhoods
// match best (RGBA SSD over a 24px strip, premultiplied), crop to [xL, xR) and cross-fade a short B px.
// usage: node docs/art/tools/t10_tilecut.cjs <in.png> <out.png> [search=500] [B=24] [maxW=2752]
const sharp = require('sharp'); const [,, inp, out, sA, bA, mA] = process.argv;
const S = +(sA||500), B = +(bA||24), maxW = +(mA||2752), K = 24;
(async () => { const { data: d, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = (x, y, c) => { const i = (y*W+x)*4; return c < 3 ? d[i+c]*d[i+3]/255 : d[i+3]; };
  let best = [1e30, 0, W];
  for (let xl = B; xl < S; xl += 4) for (let xr = W - S; xr < W - K; xr += 4) { let e = 0;
    for (let k = 0; k < K && e < best[0]; k += 3) for (let y = 0; y < H; y += 3) for (let c = 0; c < 4; c++) { const t = px(xl+k, y, c) - px(xr+k, y, c); e += t*t; }
    if (e < best[0]) best = [e, xl, xr]; }
  const [, xl, xr] = best; // out = in[xl .. xr) ; first B px blended with in[xr .. xr+B) which continues the tail
  const OW = xr - xl, o = Buffer.alloc(OW*H*4);
  for (let y = 0; y < H; y++) for (let x = 0; x < OW; x++) { const di = (y*OW+x)*4, si = (y*W+xl+x)*4;
    if (x < B && xr + x < W) { const t = x / B, sj = (y*W+xr+x)*4; for (let c = 0; c < 4; c++) o[di+c] = Math.round(d[sj+c]*(1-t) + d[si+c]*t); }
    else for (let c = 0; c < 4; c++) o[di+c] = d[si+c]; }
  let img = sharp(o, { raw: { width: OW, height: H, channels: 4 } }); if (OW > maxW) img = sharp(await img.png().toBuffer()).resize({ width: maxW });
  const r = await img.png().toFile(out); console.log(out, r.width + 'x' + r.height, 'cut', xl, xr); })();
