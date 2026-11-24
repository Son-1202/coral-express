// Slice a bg-removed (alpha) sprite sheet into trimmed sprites via connected components.
// usage: node docs/art/tools/t12_slice.cjs <keyed.png> <outDir> name1,name2,... [--rows N] [--minfrac 0.002]
// Components are found on a downscaled alpha mask (dilated to merge nearby specks), small ones dropped,
// then the N largest kept and sorted in reading order (rows clustered by vertical centre).
// Names equal to '-' are skipped. Output trimmed, max 768 px long side.
const sharp = require('sharp');
const args = process.argv.slice(2);
const [inp, outDir, namesArg] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? +args[i + 1] : d; };
const names = namesArg.split(',');
const ROWS = opt('--rows', 1), DIL = opt('--dil', 3), SC = opt('--scale', 4);
(async () => {
  const { data, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, w = Math.ceil(W / SC), h = Math.ceil(H / SC);
  let m = new Uint8Array(w * h);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) m[((y / SC) | 0) * w + ((x / SC) | 0)] = 1;
  for (let d = 0; d < DIL; d++) { const n = m.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y*w+x]) { if (x>0) n[y*w+x-1]=1; if (x<w-1) n[y*w+x+1]=1; if (y>0) n[(y-1)*w+x]=1; if (y<h-1) n[(y+1)*w+x]=1; } m = n; }
  const lab = new Int32Array(w * h), comps = [];
  for (let s = 0; s < w * h; s++) if (m[s] && !lab[s]) {
    const c = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0, id: comps.length + 1 }; const st = [s]; lab[s] = c.id;
    while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; c.n++; c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue; const nk = ny*w+nx; if (m[nk] && !lab[nk]) { lab[nk] = c.id; st.push(nk); } } }
    comps.push(c);
  }
  let keep = comps.sort((a, b) => b.n - a.n).slice(0, names.length);
  console.log('components', comps.length, 'sizes', comps.slice(0, names.length + 3).map(c => c.n).join(','));
  keep.forEach(c => c.cy = (c.y0 + c.y1) / 2);
  keep.sort((a, b) => a.cy - b.cy);
  const per = Math.ceil(keep.length / ROWS), rows = [];
  for (let r = 0; r < ROWS; r++) rows.push(keep.slice(r * per, (r + 1) * per).sort((a, b) => a.x0 - b.x0));
  keep = rows.flat();
  for (let i = 0; i < keep.length; i++) {
    if (names[i] === '-') continue;
    const c = keep[i];
    // copy only pixels belonging to this component (by label at downscaled res) so neighbours never bleed in
    const X0 = c.x0 * SC, Y0 = c.y0 * SC, X1 = Math.min(W - 1, (c.x1 + 1) * SC - 1), Y1 = Math.min(H - 1, (c.y1 + 1) * SC - 1);
    const cw = X1 - X0 + 1, ch = Y1 - Y0 + 1, buf = Buffer.alloc(cw * ch * 4);
    let tx0 = 1e9, ty0 = 1e9, tx1 = -1, ty1 = -1;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      if (lab[((y / SC) | 0) * w + ((x / SC) | 0)] !== c.id) continue;
      const si = (y * W + x) * 4, di = ((y - Y0) * cw + (x - X0)) * 4;
      data.copy(buf, di, si, si + 4);
      if (data[si + 3] > 24) { tx0 = Math.min(tx0, x - X0); ty0 = Math.min(ty0, y - Y0); tx1 = Math.max(tx1, x - X0); ty1 = Math.max(ty1, y - Y0); }
    }
    let img = sharp(buf, { raw: { width: cw, height: ch, channels: 4 } }).extract({ left: tx0, top: ty0, width: tx1 - tx0 + 1, height: ty1 - ty0 + 1 });
    const edge = c.x0 === 0 || c.y0 === 0 || c.x1 === w - 1 || c.y1 === h - 1;
    if (Math.max(tx1 - tx0, ty1 - ty0) + 1 > 768) img = sharp(await img.png().toBuffer()).resize({ width: 768, height: 768, fit: 'inside', kernel: 'lanczos3' });
    const r = await img.png().toFile(`${outDir}/${names[i]}.png`);
    console.log(names[i], r.width + 'x' + r.height, edge ? 'WARNING touches sheet edge' : '');
  }
})();
