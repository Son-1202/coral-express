// T-31 helpers: best-period seamless tiling for strips + sheet slicing.
const sharp = require('sharp');
// RGBA raw {data,W,H} -> seamless RGBA raw. Finds cut c in [0.6W, W-B] whose B-px window best matches the
// image's first B columns, then cross-fades: out[x<B] = lerp(in[c+x], in[x], x/B); out width = c.
function seamless({ data, W, H }, B = 48) {
  let best = Infinity, cut = W - B; const step = 2;
  for (let c = Math.floor(W * 0.6); c <= W - B; c++) { let d = 0;
    for (let y = 0; y < H; y += step) for (let x = 0; x < B; x += 4) {
      const a = (y*W + x)*4, b = (y*W + c + x)*4;
      d += Math.abs(data[a]-data[b]) + Math.abs(data[a+1]-data[b+1]) + Math.abs(data[a+2]-data[b+2]) + Math.abs(data[a+3]-data[b+3]); }
    if (d < best) { best = d; cut = c; } }
  const OW = cut, o = Buffer.alloc(OW*H*4);
  for (let y = 0; y < H; y++) for (let x = 0; x < OW; x++) { const di = (y*OW+x)*4, si = (y*W+x)*4;
    if (x < B) { const t = x / B, sj = (y*W + cut + x)*4; for (let c = 0; c < 4; c++) o[di+c] = Math.round(data[sj+c]*(1-t) + data[si+c]*t); }
    else for (let c = 0; c < 4; c++) o[di+c] = data[si+c]; }
  return { data: o, W: OW, H, cut };
}
async function load(p) { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; }
function crop({ data, W }, l, t, w, h) { const o = Buffer.alloc(w*h*4);
  for (let y = 0; y < h; y++) data.copy(o, y*w*4, ((t+y)*W + l)*4, ((t+y)*W + l + w)*4); return { data: o, W: w, H: h }; }
const toSharp = ({ data, W, H }) => sharp(data, { raw: { width: W, height: H, channels: 4 } });
module.exports = { seamless, load, crop, toSharp };
