// Slice a keyed 3x2 creature sheet into trimmed sprites.
// usage: node docs/art/tools/slice_fish.cjs <keyed_sheet.png> <outDir> id1,id2,id3,id4,id5,id6
const sharp = require('sharp');
const [,, inp, outDir, ids] = process.argv;
const names = ids.split(',');
(async () => {
  const meta = await sharp(inp).metadata();
  const cw = Math.floor(meta.width / 3), ch = Math.floor(meta.height / 2);
  for (let i = 0; i < 6; i++) {
    if (names[i] === '-') continue;
    const cx = (i % 3) * cw, cy = Math.floor(i / 3) * ch;
    const cell = sharp(inp).extract({ left: cx, top: cy, width: cw, height: ch });
    const { data, info } = await cell.clone().raw().toBuffer({ resolveWithObject: true });
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const pad = 4;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(info.width - 1, x1 + pad); y1 = Math.min(info.height - 1, y1 + pad);
    const touches = x0 === 0 || y0 === 0 || x1 === info.width - 1 || y1 === info.height - 1;
    let img = sharp(await cell.png().toBuffer()).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
    if (Math.max(x1 - x0, y1 - y0) + 1 > 768) img = img.resize({ width: 768, height: 768, fit: 'inside', kernel: 'nearest' });
    const r = await img.png().toFile(`${outDir}/${names[i]}.png`);
    console.log(names[i], r.width + 'x' + r.height, touches ? 'WARNING touches cell edge' : '');
  }
})();
