// Seam check: each strip tiled twice side by side (seam in the middle), scaled to 1400 px wide, on magenta.
// usage: node docs/art/tools/t31_preview.cjs <out.jpg> name...
const sharp = require('sharp'); const [,, out, ...names] = process.argv;
(async () => { const rows = []; let y = 0;
  for (const n of names) { const p = 'assets/_cut/scenery/' + n + '.png'; const m = await sharp(p).metadata();
    const two = await sharp({ create: { width: m.width*2, height: m.height, channels: 4, background: '#ff00ff' } })
      .composite([{ input: p, left: 0, top: 0 }, { input: p, left: m.width, top: 0 }]).png().toBuffer();
    const r = await sharp(two).resize({ width: 1400 }).flatten({ background: '#ff00ff' }).png().toBuffer({ resolveWithObject: true });
    rows.push({ input: r.data, left: 0, top: y }); y += r.info.height + 6; }
  await sharp({ create: { width: 1400, height: y, channels: 3, background: '#000' } }).composite(rows).jpeg({ quality: 82 }).toFile(out); console.log(out); })();
