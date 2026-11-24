// Contact sheet of all T-10 kept assets on a checkerboard -> docs/art/candidates/T-10_contact.jpg
const sharp = require('sharp'); const C = 'assets/_cut/';
const rows = [
  ['scenery/l2_far.png','scenery/l2_mid.png','scenery/l2_near.png'],
  ['scenery/l3_far.png','scenery/l3_mid.png','scenery/l3_near.png'],
  ['station/l2.png','station/l3.png','train/interior_kelp.png','train/interior_polar.png','train/interior_vent.png'],
  ['fish/garibaldi.png','fish/kelp_seahorse.png','fish/leafy_seadragon.png','fish/ice_krill.png','fish/icefish.png','fish/snow_crab.png'],
  ['fish/tubeworm.png','fish/yeti_crab.png','fish/scaly_snail.png','fish/vent_octopus.png','fish/ghost_ray.png','fish/pocket_whale.png']];
const W = 2400, RH = [300, 300, 300, 260, 260], G = 12, H = RH.reduce((a, b) => a + b + G, G);
(async () => { const px = Buffer.alloc(W*H*3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px.fill(((x>>4)+(y>>4))%2 ? 200 : 235, (y*W+x)*3, (y*W+x)*3+3);
  const comps = []; let y = G;
  for (let r = 0; r < rows.length; r++) { const cw = Math.floor((W - G) / rows[r].length) - G; let x = G;
    for (const f of rows[r]) { const b = await sharp(C + f).resize({ width: cw, height: RH[r], fit: 'inside' }).png().toBuffer();
      const m = await sharp(b).metadata(); comps.push({ input: b, left: x + ((cw - m.width) >> 1), top: y + ((RH[r] - m.height) >> 1) }); x += cw + G; }
    y += RH[r] + G; }
  await sharp(px, { raw: { width: W, height: H, channels: 3 } }).composite(comps).jpeg({ quality: 85 }).toFile('docs/art/candidates/T-10_contact.jpg');
  console.log('contact', W + 'x' + H); })();
