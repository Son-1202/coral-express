// Make a layer seamless horizontally by cross-fading its right edge into its left edge, then resize.
// usage: node docs/art/tools/t10_tile.cjs <in.png> <out.png> [blend=192] [maxW=2752]
// out[x<B] = lerp(in[W-B+x], in[x], x/B); out width = W-B; so out wraps out[W-B-1] -> out[0] continuously.
const sharp = require('sharp'); const [,, inp, out, bA, mA] = process.argv; const B = +(bA||192), maxW = +(mA||2752);
(async () => { const { data, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, OW = W - B, o = Buffer.alloc(OW*H*4);
  for (let y = 0; y < H; y++) for (let x = 0; x < OW; x++) { const di = (y*OW+x)*4, si = (y*W+x)*4;
    if (x < B) { const t = x / B, sj = (y*W + W - B + x)*4; for (let c = 0; c < 4; c++) o[di+c] = Math.round(data[sj+c]*(1-t) + data[si+c]*t); }
    else for (let c = 0; c < 4; c++) o[di+c] = data[si+c]; }
  let img = sharp(o, { raw: { width: OW, height: H, channels: 4 } }); if (OW > maxW) img = sharp(await img.png().toBuffer()).resize({ width: maxW });
  const r = await img.png().toFile(out); console.log(out, r.width + 'x' + r.height); })();
