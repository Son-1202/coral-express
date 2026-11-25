// T-34 contact sheet: node docs/art/tools/t34_contact.cjs <iconPreview.png> <mock.png>  -> docs/art/candidates/T-34_contact.jpg
const sharp = require('sharp'); const path = require('path');
const R = p => path.resolve(__dirname, '../../..', p);
(async () => {
  const [iconPrev, mock] = process.argv.slice(2);
  const W = 1800, cell = 340, pad = 16, rows = [];
  const tile = async (p, w, h, bg = '#ff00ff') => sharp(await sharp(R(p)).flatten({ background: bg }).png().toBuffer()).resize(w, h, { fit: 'contain', background: '#202020' }).png().toBuffer();
  const row1 = ['shed_A', 'shed_B', 'pool_A', 'buffer_A'].map(n => `assets/_raw/t34/${n}.png`);
  const row2 = ['icon_A', 'icon_B', 'icon_C', 'icon_D'].map(n => `assets/_raw/t34/${n}.png`);
  const comp = []; let y = pad;
  for (const row of [row1, row2]) { let x = pad; for (const p of row) { comp.push({ input: await tile(p, 420, cell), left: x, top: y }); x += 420 + pad; } y += cell + pad; }
  for (const n of ['yard_A', 'yard_B']) { comp.push({ input: await tile(`assets/_raw/t34/${n}.png`, 880, 380), left: n === 'yard_A' ? pad : 880 + 2 * pad, top: y }); } y += 380 + pad;
  comp.push({ input: await sharp(mock).resize(1100).png().toBuffer(), left: pad, top: y });
  comp.push({ input: await sharp(iconPrev).resize(660).png().toBuffer(), left: 1100 + 2 * pad, top: y });
  y += Math.round(720 * 1100 / 1600) + pad;
  await sharp({ create: { width: W, height: y, channels: 3, background: '#2a2a2a' } }).composite(comp).jpeg({ quality: 82 }).toFile(R('docs/art/candidates/T-34_contact.jpg'));
  console.log('contact', W + 'x' + y);
})();
