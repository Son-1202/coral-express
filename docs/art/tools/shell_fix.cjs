// Car shell A post-process: key flat-grey bg (key.cjs output), knock out tank window rect,
// erase brown rail pixels under the wheels, trim, cap 768.
// usage: node docs/art/tools/shell_fix.cjs <keyed.png> <out.png> L T R B railTopY
const sharp = require('sharp');
const [,, inp, out, L, T, R, B, RY] = process.argv.map((v, i) => i > 3 ? +v : v);
(async () => {
  const { data, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const src = Buffer.from(data);
  // Protect wheel discs from the rail-erasing rule (restore source pixels inside each wheel circle).
  // WHEELS env: "cx,cy,r;cx,cy,r;..." in source pixels.
  const wheels = (process.env.WHEELS || '').split(';').filter(Boolean).map(w => w.split(',').map(Number));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (x >= L && x <= R && y >= T && y <= B) { data[i + 3] = 0; continue; }
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (y >= RY && (data[i] - data[i + 2] > 6 || lum > 150 || y >= RY + 18)) data[i + 3] = 0;
    if (data[i + 3] < 40) data[i + 3] = 0;
  }
  for (const [cx, cy, r] of wheels) for (let y = cy; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
    const d = (y * W + x) * 4, si = d; // protect: restore source pixels inside the wheel disc
    if (src[si + 3] < 40) continue;
    data[d] = src[si]; data[d + 1] = src[si + 1]; data[d + 2] = src[si + 2]; data[d + 3] = src[si + 3];
  }
  const buf = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const t = await sharp(buf).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const r = await sharp(t.data).resize({ width: 768, height: 768, fit: 'inside', kernel: 'lanczos3' }).png().toFile(out);
  console.log(out, r.width + 'x' + r.height, 'trimOffset', t.info.trimOffsetLeft, t.info.trimOffsetTop, 'scale', (r.width / t.info.width).toFixed(4));
})();
