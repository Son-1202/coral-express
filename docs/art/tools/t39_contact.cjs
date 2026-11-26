// T-39 contact sheet: node docs/art/tools/t39_contact.cjs -> docs/art/candidates/T-39_contact.jpg
// Row 1-2: old vs new interior (kelp, vent) at 640x360 with in-game fish sprites (assets/fish, 2x nearest) composited.
// Row 3: icons at 32 px, 1x and 4x nearest, next to shell.png / shells_per_sec.png.
const sharp = require('sharp');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const R = (p) => path.join(ROOT, p);
const W = 640, H = 360;
const FISH = { kelp: ['garibaldi', 'kelp_seahorse', 'leafy_seadragon', 'vent_octopus', 'clownfish'],
  vent: ['yeti_crab', 'scaly_snail', 'ghost_ray', 'vent_octopus', 'tubeworm'] };
const POS = [[60, 70], [250, 150], [420, 60], [120, 230], [460, 220]];
async function panel(file, fish) {
  const comps = [];
  for (let i = 0; i < fish.length; i++) {
    const f = sharp(R(`assets/fish/${fish[i]}.png`)); const m = await f.metadata();
    comps.push({ input: await f.resize(m.width * 2, m.height * 2, { kernel: 'nearest' }).png().toBuffer(), left: POS[i][0], top: POS[i][1] });
  }
  return sharp(R(file)).resize(W, H, { fit: 'fill' }).composite(comps).png().toBuffer();
}
const ICONS = ['shell', 'shells_per_sec', 'feed', 'tankview', 'special_slot', 'special_cosmetic', 'sight_festival', 'sight_stowaway', 'sight_seafog'];
(async () => {
  const PAD = 16, CW = W * 2 + PAD * 3, comps = [];
  let y = PAD;
  for (const hab of ['kelp', 'vent']) {
    comps.push({ input: await panel(`assets/_raw/t39/old_interior_${hab}.png`, FISH[hab]), left: PAD, top: y });
    comps.push({ input: await panel(`assets/train/interior_${hab}.png`, FISH[hab]), left: PAD * 2 + W, top: y });
    y += H + PAD;
  }
  // icons: 4x row and 1x row on a mid-tone HUD-like strip
  const cell = 140;
  for (let i = 0; i < ICONS.length; i++) {
    const s = sharp(R(`assets/icons/${ICONS[i]}.png`)); const m = await s.metadata();
    comps.push({ input: await s.clone().resize(m.width * 4, m.height * 4, { kernel: 'nearest' }).png().toBuffer(), left: PAD + i * cell + 4, top: y + 8 });
    comps.push({ input: await s.png().toBuffer(), left: PAD + i * cell + 50, top: y + 150 });
  }
  const CH = y + 200;
  await sharp({ create: { width: CW, height: CH, channels: 3, background: '#3d4f55' } })
    .composite([{ input: { create: { width: CW - 2 * PAD, height: 190, channels: 3, background: '#e9e1cc' } }, left: PAD, top: y }, ...comps])
    .jpeg({ quality: 88 }).toFile(R('docs/art/candidates/T-39_contact.jpg'));
  console.log('contact', CW + 'x' + CH);
})().catch((e) => { console.error(e); process.exit(1); });
