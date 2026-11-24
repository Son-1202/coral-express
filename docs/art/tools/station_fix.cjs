// Station D: after `key.cjs <raw> <keyed> 12 --global`, restore the lantern glass (grey, enclosed by brass)
// that the global key removed, then trim and cap to 768.
// usage: node docs/art/tools/station_fix.cjs <keyed.png> <raw.png> <out.png>   (box/bg hard-coded for station_D)
const s = require('sharp');
const [,, keyed, raw, out] = process.argv;
(async () => {
  const A = await s(keyed).raw().toBuffer({ resolveWithObject: true }); const O = await s(raw).ensureAlpha().raw().toBuffer();
  const W = A.info.width, X0 = 1490, Y0 = 640, BW = 130, BH = 170;
  const isBg = (x, y) => { const i = (y * W + x) * 4; return Math.max(Math.abs(O[i] - 195), Math.abs(O[i + 1] - 195), Math.abs(O[i + 2] - 193)) <= 12; };
  const seen = new Uint8Array(BW * BH), st = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= BW || y >= BH) return; const k = y * BW + x; if (seen[k] || !isBg(X0 + x, Y0 + y)) return; seen[k] = 1; st.push(k); };
  for (let x = 0; x < BW; x++) { push(x, 0); push(x, BH - 1); } for (let y = 0; y < BH; y++) { push(0, y); push(BW - 1, y); }
  while (st.length) { const k = st.pop(), x = k % BW, y = (k / BW) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  for (let y = 1; y < BH - 1; y++) for (let x = 1; x < BW - 1; x++) {
    const k = y * BW + x; if (seen[k] || seen[k - 1] || seen[k + 1] || seen[k - BW] || seen[k + BW]) continue;
    const i = ((Y0 + y) * W + X0 + x) * 4; if (A.data[i + 3] < 255) { for (let c = 0; c < 3; c++) A.data[i + c] = O[i + c]; A.data[i + 3] = 255; }
  }
  const t = await s(await s(A.data, { raw: A.info }).png().toBuffer()).trim({ threshold: 1 }).toBuffer();
  const o = await s(t).resize({ width: 768, height: 768, fit: 'inside', kernel: 'lanczos3' }).png().toFile(out);
  console.log(out, o.width + 'x' + o.height);
})();
