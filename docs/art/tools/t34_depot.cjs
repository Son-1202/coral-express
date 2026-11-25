// T-34 depot build, step 1: node docs/art/tools/t34_depot.cjs
// raw (assets/_raw/t34) -> keyed cutouts assets/_cut/depot/*.png (grey bg keyed with t10_keylib, trimmed, 4 px pad)
// + yard strip (seamless, grey sky keyed) straight to assets/depot/yard.png (painterly, not pixelized).
// Step 2 (pixel sprites): npx tsx docs/art/tools/t34_pixel.ts
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { keyRGB, bbox } = require('./t10_keylib.cjs');
const { seamless, toSharp } = require('./t31_lib.cjs');
const ROOT = path.resolve(__dirname, '../../..');
const RAW = p => path.join(ROOT, 'assets/_raw/t34', p + '.png');
const CUT = path.join(ROOT, 'assets/_cut/depot');
const OUT = path.join(ROOT, 'assets/depot');

async function keyed(name, out, opt = {}) {
  const { data, info } = await sharp(RAW(name)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { rgba, bg } = keyRGB(data, info.width, info.height, { tol: 18, sat: 12, minHole: 1500, ...opt });
  const b = bbox(rgba, info.width, info.height), pad = 4;
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(b).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(CUT, out + '.png'));
  console.log(name, '->', out, b.width + 'x' + b.height, 'bg', bg.join(','));
}

async function yard(name) {
  const { data, info } = await sharp(RAW(name)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const { rgba } = keyRGB(data, W, H, { tol: 16, sat: 10, minHole: 1e9 }); // only border-connected grey (the empty top)
  // force full opacity below the crate line (the gravel is never transparent)
  let top = H; for (let y = 0; y < H && top === H; y++) for (let x = 0; x < W; x++) if (rgba[(y*W+x)*4+3]) { top = y; break; }
  const s = seamless({ data: rgba, W, H }, 64);
  // crop the empty grey rows above the tallest crate (keep 4 px)
  const t0 = Math.max(0, top - 4);
  await toSharp(s).extract({ left: 0, top: t0, width: s.W, height: H - t0 }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'yard.png'));
  console.log('yard', s.W + 'x' + (H - t0), 'cut', s.cut, 'top', top);
}

(async () => {
  fs.mkdirSync(CUT, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  await keyed('shed_B', 'shed');
  await keyed('shed_A', 'shed_alt');
  await keyed('pool_A', 'pool');
  await keyed('buffer_A', 'buffer');
  await yard('yard_B');
})().catch(e => { console.error(e); process.exit(1); });
