// Crop a horizontal band from a scenery raw and key out the grey bg with t10_keylib.
// usage: node docs/art/tools/t10_band.cjs <in.png> <out.png> <top> <height> [tol=22] [sat=14] [minHole=400]
const sharp = require('sharp'); const { keyRGB, bbox } = require('./t10_keylib.cjs');
const [,, inp, out, top, h, tol, sat, hole] = process.argv;
(async () => { const m = await sharp(inp).metadata();
  const { data, info } = await sharp(inp).extract({ left: 0, top: +top, width: m.width, height: +h }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W0=info.width, med=a=>a.sort((p,q)=>p-q)[a.length>>1], tr=[[],[],[]];
  for (let x=0;x<W0;x++) for (let c=0;c<3;c++) tr[c].push(data[x*3+c]); // bg = median of the band's TOP row
  const { rgba, bg } = keyRGB(data, info.width, info.height, { bg: tr.map(med), tol: +(tol||22), sat: +(sat||14), minHole: +(hole||400) });
  const bb = bbox(rgba, info.width, info.height);
  const r = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: 0, top: bb.top, width: info.width, height: bb.height }).png().toFile(out);
  console.log(out, r.width + 'x' + r.height, 'bg', bg.join(',')); })();
