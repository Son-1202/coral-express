/**
 * postbuild.ts — strip ART working files from dist/ (D-016).
 * `assets/` is Vite's publicDir, so `_cut/`, `_raw/` and the style bible would be shipped otherwise.
 * Run automatically by `npm run build`.
 */
import { existsSync, rmSync } from 'node:fs';
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
