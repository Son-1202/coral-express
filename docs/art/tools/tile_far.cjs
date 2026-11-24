// Make a horizontally seamless tile by crossfading the right O columns into the left edge.
// usage: node docs/art/tools/tile_far.cjs <in.png> <out.png> <overlapPx> [finalWidth=2752] [preview.jpg]
const sharp = require('sharp');
const [,, inp, out, oArg, fwArg, prev] = process.argv;
const O = +oArg, FW = +(fwArg || 2752);
(async () => {
  const { data, info } = await sharp(inp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, NW = W - O;
  const o = Buffer.alloc(NW * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < NW; x++) {
    let a = 1; if (x < O) { const t = x / O; a = t * t * (3 - 2 * t); }
    for (let c = 0; c < 3; c++) {
      const L = data[(y * W + x) * 3 + c];
      const R = x < O ? data[(y * W + (NW + x)) * 3 + c] : L;
      o[(y * NW + x) * 3 + c] = Math.round(a * L + (1 - a) * R);
    }
  }
  const img = sharp(o, { raw: { width: NW, height: H, channels: 3 } });
  const fh = Math.round(H * FW / NW);
  await img.clone().resize(FW, fh, { kernel: 'lanczos3' }).png().toFile(out);
  if (prev) { // 2x tiled preview
    const t = await sharp(out).resize({ width: 800 }).toBuffer(); const m = await sharp(t).metadata();
    await sharp({ create: { width: 1600, height: m.height, channels: 3, background: '#000' } })
      .composite([{ input: t, left: 0, top: 0 }, { input: t, left: 800, top: 0 }]).jpeg().toFile(prev);
  }
  console.log(out, FW + 'x' + fh);
})();
