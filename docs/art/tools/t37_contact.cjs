// T-37 contact sheet: node docs/art/tools/t37_contact.cjs -> docs/art/candidates/T-37_contact.jpg
// Rows (nearest ×3): bunting tiled ×3 (seams marked by ticks below), lanterns tiled ×3, confetti sheet + 8 slices, flag;
// then a mock: bunting + lanterns tiled over the producer screenshot.
const sharp = require('sharp');
const F = 'assets/festival/';
const S = 3, BG = { r: 120, g: 150, b: 170, alpha: 1 };
(async () => {
  const meta = async p => (await sharp(p).metadata());
  const up = async (p, s = S) => { const m = await meta(p); return { input: await sharp(p).resize(m.width * s, m.height * s, { kernel: 'nearest' }).png().toBuffer(), w: m.width * s, h: m.height * s }; };
  const comps = []; let y = 20; const W = 1900;
  const tick = (x, yy) => ({ input: { create: { width: 2, height: 10, channels: 4, background: { r: 255, g: 40, b: 40, alpha: 1 } } }, left: x, top: yy });
  for (const n of ['bunting', 'lanterns']) {
    const t = await up(F + n + '.png');
    for (let i = 0; i < 3; i++) { comps.push({ input: t.input, left: 20 + i * t.w, top: y }); comps.push(tick(20 + i * t.w, y + t.h + 2)); }
    y += t.h + 30;
  }
  const c = await up(F + 'confetti.png', 4); comps.push({ input: c.input, left: 20, top: y });
  let x = 40 + c.w;
  for (let i = 1; i <= 8; i++) { const s = await up(F + `confetti_${i}.png`, 4); comps.push({ input: s.input, left: x, top: y }); x += s.w + 16; }
  const fl = await up(F + 'flag.png'); comps.push({ input: fl.input, left: x + 30, top: y });
  y += Math.max(c.h, fl.h) + 30;
  // mock over producer screenshot (scaled to W-40 wide); bunting at 2x so pennants match the screenshot's scale
  const shot = 'docs/qa/producer/festival_placeholder.png'; const sm = await meta(shot); const mw = W - 40, mh = Math.round(sm.height * mw / sm.width);
  const mock = [];
  for (const [n, top, sc] of [['bunting', 300, 2], ['lanterns', 150, 2]]) { const t = await up(F + n + '.png', sc); for (let xx = 0; xx < mw; xx += t.w) mock.push({ input: t.input, left: xx, top }); }
  const fl2 = await up(F + 'flag.png', 2); mock.push({ input: fl2.input, left: 1300, top: 520 - fl2.h });
  const mockBuf = await sharp(shot).resize(mw, mh).composite(mock).png().toBuffer();
  comps.push({ input: mockBuf, left: 20, top: y }); y += mh + 20;
  await sharp({ create: { width: W, height: y, channels: 4, background: BG } }).composite(comps).flatten({ background: BG }).jpeg({ quality: 88 }).toFile('docs/art/candidates/T-37_contact.jpg');
  console.log('contact', W, y);
})();
