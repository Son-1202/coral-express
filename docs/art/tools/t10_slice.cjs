// Slice a 3x2 sprite sheet into keyed, trimmed sprites (max 768px long side).
// usage: node docs/art/tools/t10_slice.cjs <sheet.png> <outDir> id1,id2,...,id6 [inset=14] [minHole=150]
const sharp = require('sharp'); const { keyRGB, bbox } = require('./t10_keylib.cjs');
const [,, inp, outDir, idsA, insetA, holeA] = process.argv;
const ids = idsA.split(','), inset = +(insetA || 14), minHole = +(holeA || 150);
(async () => { const m = await sharp(inp).metadata(); const cw = Math.floor(m.width / 3), ch = Math.floor(m.height / 2);
  for (let k = 0; k < 6; k++) { const cx = (k % 3) * cw + inset, cy = Math.floor(k / 3) * ch + inset, w = cw - 2*inset, h = ch - 2*inset;
    const { data } = await sharp(inp).extract({ left: cx, top: cy, width: w, height: h }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { rgba, bg } = keyRGB(data, w, h, { minHole }); const bb = bbox(rgba, w, h);
    if (!bb) { console.log(ids[k], 'EMPTY'); continue; }
    const pad = 6; const img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).extract(bb)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } });
    const buf = await img.png().toBuffer(); const mm = await sharp(buf).metadata();
    const scale = Math.min(1, 768 / Math.max(mm.width, mm.height));
    const info = await sharp(buf).resize({ width: Math.round(mm.width*scale), kernel: 'nearest' }).png().toFile(`${outDir}/${ids[k]}.png`);
    console.log(ids[k], info.width + 'x' + info.height, 'bg', bg.join(','), 'bbox', JSON.stringify(bb)); } })();
