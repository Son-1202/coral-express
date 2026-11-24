/**
 * postbuild.ts — strip ART working files from dist/ (D-016).
 * `assets/` is Vite's publicDir, so `_cut/`, `_raw/` and the style bible would be shipped otherwise.
 * Run automatically by `npm run build`.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const REMOVE = ['_cut', '_raw', 'style_bible.png', 'style_bible.webp'];
for (const r of REMOVE) {
  const p = join(DIST, r);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`postbuild: removed ${p}`);
  }
}

// Painterly scenery is loaded as .webp by src/render/diorama/lineArt.ts (fileUrl prefers webp);
// drop the heavy PNG twins from the deploy (≈40 MB). Other dirs keep PNGs (other loaders use them).
const sceneryDir = join(DIST, 'scenery');
if (existsSync(sceneryDir)) {
  let n = 0;
  for (const f of readdirSync(sceneryDir)) {
    if (!f.endsWith('.png')) continue;
    if (existsSync(join(sceneryDir, f.replace(/\.png$/, '.webp')))) {
      rmSync(join(sceneryDir, f));
      n++;
    }
  }
  console.log(`postbuild: removed ${n} scenery PNG(s) with .webp twins`);
}
