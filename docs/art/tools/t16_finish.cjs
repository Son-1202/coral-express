// T-16: copy/crop/resize kept raws (assets/_raw/t16) into assets/_cut. Run from repo root.
// Backdrops 2752x1536 (same as interiors); key art + line covers 1920 wide; postcards 1536x1024; Wren 1024x1024.
const sharp = require('sharp'); const R = 'assets/_raw/t16/', C = 'assets/_cut/';
const habit = ['reef', 'mangrove', 'kelp', 'polar', 'vent'];
const pick = { backdrop_polar_2: 'backdrop_polar_2_r1', backdrop_vent_2: 'backdrop_vent_2_r1', postcard_l3s6: 'postcard_l3s6_r1' };
const src = n => R + (pick[n] || n) + '.png';
const crops = { postcard_l2s1: { left: 64, top: 48, width: 2400, height: 1600 } }; // cream border painted in
const jobs = [];
for (const h of habit) for (const k of [1, 2]) jobs.push([`backdrop_${h}_${k}`, `train/backdrop_${h}_${k}.png`, 2752, 1536]);
for (let l = 1; l <= 3; l++) for (let s = 1; s <= 6; s++) jobs.push([`postcard_l${l}s${s}`, `ui/postcard_l${l}s${s}.png`, 1536, 1024]);
for (let l = 1; l <= 3; l++) jobs.push([`line_cover_${l}`, `ui/line_cover_${l}.png`, 1920, 1080]);
jobs.push(['title_C', 'ui/title_keyart.png', 1920, 1080], ['ending_C', 'ui/ending_keyart.png', 1920, 1080], ['wren_portrait', 'ui/wren_portrait.png', 1024, 1024]);
(async () => { for (const [n, out, w, h] of jobs) { let img = sharp(src(n)).removeAlpha(); if (crops[n]) img = img.extract(crops[n]);
  const r = await img.resize({ width: w, height: h, fit: 'cover' }).png({ compressionLevel: 9 }).toFile(C + out); console.log(out, r.width + 'x' + r.height, (r.size / 1e6).toFixed(1) + 'MB'); } })();
