// Preview grid of jpgs: node t12_grid.cjs <dir> <out.jpg> name1,name2,...  (2 columns, 700px cells)
const s = require('sharp'); const [, , dir, out, names] = process.argv;
(async () => { const fs = names.split(','); const CW = 700, CH = 420;
  const imgs = await Promise.all(fs.map(f => s(`${dir}/${f}.jpg`).resize({ width: CW, height: CH, fit: 'contain', background: '#000' }).toBuffer()));
  await s({ create: { width: CW * 2, height: CH * Math.ceil(fs.length / 2), channels: 3, background: '#000' } })
    .composite(imgs.map((b, i) => ({ input: b, left: (i % 2) * CW, top: Math.floor(i / 2) * CH }))).jpeg({ quality: 80 }).toFile(out); })();
