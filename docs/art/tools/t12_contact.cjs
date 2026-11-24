// Contact sheet of every T-12 output on a checkerboard -> docs/art/candidates/T-12_contact.jpg
const s = require('sharp'), fs = require('fs'), path = require('path');
const C = 'assets/_cut', dirs = ['plants', 'decor', 'wildlife', 'passengers', 'sights', 'icons'];
const files = [];
for (const d of dirs) for (const f of fs.readdirSync(`${C}/${d}`).sort()) files.push(`${C}/${d}/${f}`);
for (const f of fs.readdirSync(`${C}/scenery`).sort()) if (/^l\d_(foliage|props)_/.test(f)) files.push(`${C}/scenery/${f}`);
for (const f of ['ui/photo_frames_1.png', 'ui/photo_frames_2.png', 'ui/photo_frames_3.png', 'train/wheel.png', 'train/rod.png']) files.push(`${C}/${f}`);
const CELL = 180, COLS = 12, ROWS = Math.ceil(files.length / COLS), LAB = 14;
(async () => {
  const W = CELL * COLS, H = (CELL + LAB) * ROWS;
  const sq = 12, chk = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = ((x / sq | 0) + (y / sq | 0)) % 2 ? 200 : 235; chk.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3); }
  const comps = [];
  for (let i = 0; i < files.length; i++) {
    const buf = await s(files[i]).resize({ width: CELL - 8, height: CELL - 8, fit: 'inside' }).png().toBuffer();
    const m = await s(buf).metadata();
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * (CELL + LAB);
    comps.push({ input: buf, left: cx + ((CELL - m.width) >> 1), top: cy + ((CELL - m.height) >> 1) });
    const name = path.basename(files[i], '.png');
    comps.push({ input: Buffer.from(`<svg width="${CELL}" height="${LAB}"><rect width="100%" height="100%" fill="#222"/><text x="3" y="11" font-size="10" font-family="monospace" fill="#fff">${name}</text></svg>`), left: cx, top: cy + CELL });
  }
  await s(chk, { raw: { width: W, height: H, channels: 3 } }).composite(comps).jpeg({ quality: 82 }).toFile('docs/art/candidates/T-12_contact.jpg');
  console.log(files.length, 'files', W + 'x' + H);
})();
