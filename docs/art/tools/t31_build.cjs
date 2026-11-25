// T-31 build: raw candidates (assets/_raw/t31) -> assets/_cut/scenery finals.
// usage: node docs/art/tools/t31_build.cjs   (picks in PICK below)
const sharp = require('sharp');
const { keyRGB, bbox } = require('./t10_keylib.cjs');
const { seamless, load, crop, toSharp } = require('./t31_lib.cjs');
const RAW = 'assets/_raw/t31/', OUT = 'assets/_cut/scenery/';
const PICK = JSON.parse(process.env.T31_PICK || '{}');
const MAXW = 2560;
async function strip(src, dst, { keyTop = false, cropTop = 0, cropBot = 1 } = {}) {
  let img = await load(RAW + src + '.png');
  const t0 = Math.round(img.H * cropTop), t1 = Math.round(img.H * cropBot); img = crop(img, 0, t0, img.W, t1 - t0);
  if (keyTop) { // key flat grey above the fence; bg sampled from the top rows only
    const rgb = Buffer.alloc(img.W*img.H*3); for (let i = 0; i < img.W*img.H; i++) { rgb[i*3]=img.data[i*4]; rgb[i*3+1]=img.data[i*4+1]; rgb[i*3+2]=img.data[i*4+2]; }
    const rs=[],gs=[],bs=[]; for (let y = 0; y < 6; y++) for (let x = 0; x < img.W; x += 3) { const i=(y*img.W+x)*3; rs.push(rgb[i]); gs.push(rgb[i+1]); bs.push(rgb[i+2]); }
    const med = a => a.sort((p,q)=>p-q)[a.length>>1];
    const { rgba } = keyRGB(rgb, img.W, img.H, { bg: [med(rs), med(gs), med(bs)], tol: 18, sat: 12, minHole: 300 });
    img = { data: rgba, W: img.W, H: img.H };
    const bb = bbox(rgba, img.W, img.H); const top = Math.max(0, bb.top - 4); img = crop(img, 0, top, img.W, img.H - top); }
  const s = seamless(img);
  let out = toSharp(s); if (s.W > MAXW) out = sharp(await out.png().toBuffer()).resize({ width: MAXW, kernel: 'lanczos3' });
  if (!keyTop) out = out.removeAlpha();
  const r = await out.png().toFile(OUT + dst + '.png'); console.log(dst, r.width + 'x' + r.height, 'cut', s.cut);
}
// sheet of 3 subjects in a row -> 3 trimmed sprites (column gaps of alpha)
async function sheet(src, dsts, maxH = 900) {
  const { data, info } = await sharp(RAW + src + '.png').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; const { rgba } = keyRGB(data, W, H, { tol: 20, sat: 14, minHole: 600 });
  const col = new Uint32Array(W); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rgba[(y*W+x)*4+3]) col[x]++;
  const runs = []; let s = -1; for (let x = 0; x <= W; x++) { const on = x < W && col[x] > 2; if (on && s < 0) s = x; if (!on && s >= 0) { if (x - s > 40) runs.push([s, x]); s = -1; } }
  if (runs.length !== dsts.length) throw new Error(src + ': found ' + runs.length + ' subjects ' + JSON.stringify(runs));
  for (let i = 0; i < runs.length; i++) { const [a, b] = runs[i]; const sub = crop({ data: rgba, W, H }, a, 0, b - a, H); const bb = bbox(sub.data, sub.W, sub.H);
    const pad = 4, l = Math.max(0, bb.left - pad), t = Math.max(0, bb.top - pad), w = Math.min(sub.W - l, bb.width + 2*pad), h = Math.min(sub.H - t, bb.height + 2*pad);
    let o = toSharp(crop(sub, l, t, w, h)); if (h > maxH) o = sharp(await o.png().toBuffer()).resize({ height: maxH, kernel: 'lanczos3' });
    const r = await o.png().toFile(OUT + dsts[i] + '.png'); console.log(dsts[i], r.width + 'x' + r.height); }
}
(async () => {
  for (const n of [1, 2, 3]) {
    if (PICK['l'+n+'_wall']) await strip(PICK['l'+n+'_wall'], `l${n}_wall`, { cropTop: 0, cropBot: 0.5 });
    if (PICK['l'+n+'_ground']) await strip(PICK['l'+n+'_ground'], `l${n}_ground`, { keyTop: true });
    await sheet('lens_l' + n, [1, 2, 3].map(k => `l${n}_lens_${k}`));
  }
  await sheet('planters', ['l1_planter', 'l2_planter', 'l3_planter'], 600);
  if (PICK.trackbed) await strip(PICK.trackbed, 'trackbed');
})();
