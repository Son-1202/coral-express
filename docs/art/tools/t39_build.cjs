// T-39 build: node docs/art/tools/t39_build.cjs
// 1) interiors: kelp_a (full frame) and vent_b (cropped inside the painted tank walls) -> assets/_cut/train/interior_{kelp,vent}.png (16:9)
// 2) icons: quadrant crops of the 2x2 transparent sheets icons_1/icons_2, faint alpha (<=40) zeroed, trimmed -> assets/_cut/icons/*.png
const sharp = require('sharp');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const R = (p) => path.join(ROOT, p);
const ICONS = [ // [sheet, quadrant (0=TL,1=TR,2=BL,3=BR), name]
  ['icons_1', 0, 'feed'], ['icons_1', 1, 'tankview'], ['icons_1', 2, 'special_slot'], ['icons_1', 3, 'special_cosmetic'],
  ['icons_2', 0, 'sight_festival'], ['icons_2', 1, 'sight_stowaway'], ['icons_2', 2, 'sight_seafog'],
];
const ALT = [['icons_2', 3, 'feed_pinch_alt']]; // unused candidate, kept in _raw
async function interiors() {
  await sharp(R('assets/_raw/t39/kelp_a.png')).resize(2752, 1548, { fit: 'cover' }).png().toFile(R('assets/_cut/train/interior_kelp.png'));
  // vent_b painted the tank's side walls + ceiling edge: keep x 361..2391, y 220..1362 (16:9) and scale up
  await sharp(R('assets/_raw/t39/vent_b.png')).extract({ left: 361, top: 220, width: 2030, height: 1142 })
    .resize(2752, 1548, { kernel: 'lanczos3' }).png().toFile(R('assets/_cut/train/interior_vent.png'));
}
async function icon([sheet, q, name], outDir) {
  const src = R(`assets/_raw/t39/${sheet}.png`);
  const m = await sharp(src).metadata(), hw = m.width / 2, hh = m.height / 2;
  const { data, info } = await sharp(src).extract({ left: (q % 2) * hw, top: Math.floor(q / 2) * hh, width: hw, height: hh })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) if (data[i] <= 40) data[i] = 0;
  const out = path.join(outDir, name + '.png');
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 }).png().toFile(out);
  const mm = await sharp(out).metadata(); console.log(name, mm.width + 'x' + mm.height);
}
(async () => {
  await interiors();
  for (const ic of ICONS) await icon(ic, R('assets/_cut/icons'));
  for (const ic of ALT) await icon(ic, R('assets/_raw/t39'));
})().catch((e) => { console.error(e); process.exit(1); });
