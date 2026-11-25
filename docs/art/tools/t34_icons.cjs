// T-34 app icon build: node docs/art/tools/t34_icons.cjs [rawName=icon_D]
// raw (assets/_raw/t34/<raw>.png, full-bleed square) -> assets/_cut/icons/app_icon_master.png (1024, content shrunk
// into the central ~80% with the background extended by a sampled per-row gradient) -> assets/app/* icon set.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const raw = process.argv[2] || 'icon_D';
const SRC = path.join(ROOT, 'assets/_raw/t34', raw + '.png');
const OUT = path.join(ROOT, 'assets/app');
const CUT = path.join(ROOT, 'assets/_cut/icons');
const N = 1024, SCALE = 0.86, FEATHER = 48;
const BG = '#8fd3e8';

async function rawRgb(img) { const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; }

// per-row background colour = median of the 24 outermost pixels on both sides
function rowBg({ data, W }, y) { const rs = [], gs = [], bs = [];
  for (const x0 of [0, W - 24]) for (let x = x0; x < x0 + 24; x++) { const i = (y * W + x) * 3; rs.push(data[i]); gs.push(data[i+1]); bs.push(data[i+2]); }
  const m = a => a.sort((p, q) => p - q)[a.length >> 1]; return [m(rs), m(gs), m(bs)]; }

async function master() {
  const full = await rawRgb(sharp(SRC).resize(N, N, { kernel: 'lanczos3' }));
  const inner = Math.round(N * SCALE), off = Math.round((N - inner) / 2);
  const small = await rawRgb(sharp(full.data, { raw: { width: N, height: N, channels: 3 } }).resize(inner, inner, { kernel: 'lanczos3' }));
  const out = Buffer.alloc(N * N * 3);
  // background: vertical gradient from the full-size image's edge columns (smoothed over 15 rows)
  const rows = []; for (let y = 0; y < N; y++) rows.push(rowBg(full, y));
  for (let y = 0; y < N; y++) { const acc = [0, 0, 0]; let n = 0;
    for (let k = -7; k <= 7; k++) { const r = rows[Math.min(N - 1, Math.max(0, y + k))]; acc[0] += r[0]; acc[1] += r[1]; acc[2] += r[2]; n++; }
    for (let x = 0; x < N; x++) { const i = (y * N + x) * 3; out[i] = acc[0] / n; out[i+1] = acc[1] / n; out[i+2] = acc[2] / n; } }
  // the shrunk image is placed by mapping it onto the same gradient (its rows sit at off+y*1/SCALE in the bg),
  // feathered at its border so no seam shows
  for (let y = 0; y < inner; y++) for (let x = 0; x < inner; x++) {
    const d = Math.min(x, y, inner - 1 - x, inner - 1 - y), a = Math.min(1, d / FEATHER);
    const si = (y * inner + x) * 3, di = ((y + off) * N + (x + off)) * 3;
    for (let c = 0; c < 3; c++) out[di+c] = Math.round(small.data[si+c] * a + out[di+c] * (1 - a)); }
  return { out, full };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(CUT, { recursive: true });
  const { out, full } = await master();
  const m = () => sharp(out, { raw: { width: N, height: N, channels: 3 } });
  await m().png().toFile(path.join(CUT, 'app_icon_master.png'));
  await m().png({ compressionLevel: 9 }).toFile(path.join(OUT, 'icon-1024.png'));
  const rs = (s) => m().resize(s, s, { kernel: 'lanczos3' }).png({ compressionLevel: 9 });
  await rs(180).toFile(path.join(OUT, 'apple-touch-icon.png'));
  await rs(192).toFile(path.join(OUT, 'icon-192.png'));
  await rs(512).toFile(path.join(OUT, 'icon-512.png'));
  // maskable: extra 10% padding each side filled with the manifest background colour gradient-matched edge
  const pad = Math.round(512 * 0.1), innerM = 512 - 2 * pad;
  const mi = await m().resize(innerM, innerM, { kernel: 'lanczos3' }).png().toBuffer();
  // fill = the master's own edge gradient (stretched), so the padding is seamless; flatten keeps it opaque
  const bgStrip = await sharp(out, { raw: { width: N, height: N, channels: 3 } }).extract({ left: 0, top: 0, width: 8, height: N }).resize(512, 512, { fit: 'fill' }).png().toBuffer();
  await sharp(bgStrip).composite([{ input: mi, left: pad, top: pad }]).flatten({ background: BG }).removeAlpha().png({ compressionLevel: 9 }).toFile(path.join(OUT, 'icon-maskable-512.png'));
  // favicons: tighter crop of the full-bleed art (no OS masking at tab size) so the carriage + fish read at 16/32 px
  // 16 px: the whole carriage turns to mush, so crop to the glass window + clownfish (FAV16_CROP)
  const fav = (s) => sharp(full.data, { raw: { width: N, height: N, channels: 3 } }).extract(s <= 16 ? FAV16_CROP : FAV_CROP).resize(s, s, { kernel: 'lanczos3' }).sharpen({ sigma: 0.5 }).png({ compressionLevel: 9 });
  await fav(32).toFile(path.join(OUT, 'favicon-32.png'));
  await fav(16).toFile(path.join(OUT, 'favicon-16.png'));
  await writeIco(path.join(OUT, 'favicon.ico'), [await fav(16).toBuffer(), await fav(32).toBuffer()], [16, 32]);
  const manifest = { name: 'Coral Express', short_name: 'Coral Express', start_url: '/', display: 'fullscreen', orientation: 'landscape',
    background_color: BG, theme_color: BG, icons: [
      { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/app/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' } ] };
  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('icons written to', OUT);
}
// square crop around the carriage of icon_A in 1024 space (carriage spans ~x 50..980, y 160..900)
const FAV_CROP = { left: 68, top: 92, width: 888, height: 888 }; // icon_D: carriage spans ~7..93% x, 9..92% y

const FAV16_CROP = { left: 322, top: 254, width: 540, height: 540 }; // icon_D tank window around the fish

// ICO with embedded PNG entries (supported by all modern browsers)
async function writeIco(file, pngs, sizes) {
  const head = Buffer.alloc(6 + 16 * pngs.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach((p, i) => { const e = 6 + 16 * i; head[e] = sizes[i]; head[e+1] = sizes[i]; head[e+2] = 0; head[e+3] = 0;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(p.length, e + 8); head.writeUInt32LE(offset, e + 12); offset += p.length; });
  fs.writeFileSync(file, Buffer.concat([head, ...pngs]));
}
main().catch(e => { console.error(e); process.exit(1); });
