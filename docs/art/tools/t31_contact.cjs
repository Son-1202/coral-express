// Contact sheet for T-31 finals: strips tiled 2x (seam centred) + lens/planter sprites on magenta.
// usage: node docs/art/tools/t31_contact.cjs <out.jpg>
const sharp = require('sharp'); const out = process.argv[2]; const D = 'assets/_cut/scenery/';
const strips = ['trackbed', 'l1_wall', 'l1_ground', 'l2_wall', 'l2_ground', 'l3_wall', 'l3_ground'];
(async () => { const W = 1600, rows = []; let y = 0;
  for (const n of strips) { const p = D + n + '.png'; const m = await sharp(p).metadata();
    const two = await sharp({ create: { width: m.width*2, height: m.height, channels: 4, background: '#ff00ff' } }).composite([{ input: p, left: 0, top: 0 }, { input: p, left: m.width, top: 0 }]).png().toBuffer();
    const r = await sharp(two).resize({ width: W }).flatten({ background: '#ff00ff' }).png().toBuffer({ resolveWithObject: true });
    rows.push({ input: r.data, left: 0, top: y }); y += r.info.height + 6; }
  for (const n of [1, 2, 3]) { let x = 0; const H = 260;
    for (const s of ['lens_1', 'lens_2', 'lens_3', 'planter']) { const r = await sharp(D + `l${n}_${s}.png`).resize({ height: s === 'planter' ? 170 : H }).flatten({ background: '#ff00ff' }).png().toBuffer({ resolveWithObject: true });
      rows.push({ input: r.data, left: x, top: y + H - r.info.height }); x += r.info.width + 20; }
    y += H + 6; }
  await sharp({ create: { width: W, height: y, channels: 3, background: '#222' } }).composite(rows).jpeg({ quality: 80 }).toFile(out); console.log(out); })();
