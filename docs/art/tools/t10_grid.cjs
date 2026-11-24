// Lay out transparent PNGs on a checkerboard for review/contact sheets.
// usage: node docs/art/tools/t10_grid.cjs <out.jpg> <cols> <cellPx> file1.png file2.png ...
const sharp = require('sharp'); const [,, out, colsA, cellA, ...files] = process.argv;
const cols = +colsA, cell = +cellA, rows = Math.ceil(files.length / cols), W = cols*cell, H = rows*cell;
(async () => { const sq = 16, px = Buffer.alloc(W*H*3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = ((x/sq|0)+(y/sq|0))%2 ? 200 : 235; px.fill(v, (y*W+x)*3, (y*W+x)*3+3); }
  const comps = [];
  for (let i = 0; i < files.length; i++) { const b = await sharp(files[i]).resize({ width: cell-12, height: cell-12, fit: 'inside' }).png().toBuffer();
    const m = await sharp(b).metadata(); comps.push({ input: b, left: (i%cols)*cell + ((cell-m.width)>>1), top: (i/cols|0)*cell + ((cell-m.height)>>1) }); }
  await sharp(px, { raw: { width: W, height: H, channels: 3 } }).composite(comps).jpeg({ quality: 82 }).toFile(out); console.log(out, W+'x'+H); })();
