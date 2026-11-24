// Contact sheet of all T-16 outputs on a checkerboard -> docs/art/candidates/T-16_contact.jpg; also writes hero candidate jpgs.
const sharp = require('sharp'); const C = 'assets/_cut/';
const T = ['morning', 'dusk', 'night'], H = ['reef', 'mangrove', 'kelp', 'polar', 'vent'];
const rows = [
  [1, 2, 3].flatMap(l => T.map(t => `scenery/l${l}_far_${t}.png`)).slice(0, 9),
  H.flatMap(h => [`train/backdrop_${h}_1.png`, `train/backdrop_${h}_2.png`]),
  ['ui/wren_portrait.png', 'ui/title_keyart.png', 'ui/ending_keyart.png', 'ui/line_cover_1.png', 'ui/line_cover_2.png', 'ui/line_cover_3.png'],
  [1, 2, 3].flatMap(l => [1, 2, 3, 4, 5, 6].map(s => `ui/postcard_l${l}s${s}.png`)).slice(0, 9),
  [1, 2, 3].flatMap(l => [1, 2, 3, 4, 5, 6].map(s => `ui/postcard_l${l}s${s}.png`)).slice(9),
  require('fs').readdirSync(C + 'fish').filter(f => f.includes('_shiny')).sort().map(f => 'fish/' + f)];
const W = 2400, RH = [110, 120, 220, 170, 170, 110], G = 10, Ht = RH.reduce((a, b) => a + b + G, G);
(async () => { const px = Buffer.alloc(W*Ht*3);
  for (let y = 0; y < Ht; y++) for (let x = 0; x < W; x++) px.fill(((x>>4)+(y>>4))%2 ? 200 : 235, (y*W+x)*3, (y*W+x)*3+3);
  const comps = []; let y = G;
  for (let r = 0; r < rows.length; r++) { const cw = Math.floor((W - G) / rows[r].length) - G; let x = G;
    for (const f of rows[r]) { const b = await sharp(C + f).resize({ width: cw, height: RH[r], fit: 'inside' }).png().toBuffer();
      const m = await sharp(b).metadata(); comps.push({ input: b, left: x + ((cw - m.width) >> 1), top: y + ((RH[r] - m.height) >> 1) }); x += cw + G; }
    y += RH[r] + G; }
  await sharp(px, { raw: { width: W, height: Ht, channels: 3 } }).composite(comps).jpeg({ quality: 85 }).toFile('docs/art/candidates/T-16_contact.jpg');
  for (const n of ['title_A', 'title_B', 'title_C', 'ending_A', 'ending_B', 'ending_C'])
    await sharp('assets/_raw/t16/' + n + '.png').resize({ width: 1280 }).jpeg({ quality: 82 }).toFile(`docs/art/candidates/T-16_${n}.jpg`);
  console.log('contact', W + 'x' + Ht); })();
