// Contact sheet: each image on a checkerboard tile with its label-free order given in args.
// usage: node docs/art/tools/contact.cjs <out.jpg> <cols> <cellW> <cellH> img1 img2 ...
const sharp = require('sharp');
const [,, out, colsA, cwA, chA, ...imgs] = process.argv;
const cols = +colsA, cw = +cwA, ch = +chA, pad = 12;
(async () => {
  const rows = Math.ceil(imgs.length / cols);
  const W = cols * (cw + pad) + pad, H = rows * (ch + pad) + pad;
  const sq = 16, cb = Buffer.alloc(cw * ch * 3);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const v = ((x / sq | 0) + (y / sq | 0)) % 2 ? 200 : 235; cb.fill(v, (y * cw + x) * 3, (y * cw + x) * 3 + 3); }
  const checker = await sharp(cb, { raw: { width: cw, height: ch, channels: 3 } }).png().toBuffer();
  const comps = [];
  for (let i = 0; i < imgs.length; i++) {
    const left = pad + (i % cols) * (cw + pad), top = pad + Math.floor(i / cols) * (ch + pad);
    const fit = await sharp(imgs[i]).resize({ width: cw - 8, height: ch - 8, fit: 'inside' }).png().toBuffer();
    const m = await sharp(fit).metadata();
    comps.push({ input: checker, left, top });
    comps.push({ input: fit, left: left + ((cw - m.width) >> 1), top: top + ((ch - m.height) >> 1) });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#333' } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
  console.log(out, W + 'x' + H);
})();
