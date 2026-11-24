import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Asset convention: the repo `assets/` folder is Vite's `publicDir`, so
 * `assets/scenery/l1/far.png` is served at `/scenery/l1/far.png`.
 * The `virtual:asset-list` module exposes the list of files that actually
 * exist so the loader never requests a missing file (no 404 console noise).
 */
const ASSET_DIR = 'assets';

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push('/' + relative(ASSET_DIR, p).split(sep).join('/'));
  }
  return out;
}

function assetList(): Plugin {
  const id = 'virtual:asset-list';
  const resolved = '\0' + id;
  return {
    name: 'asset-list',
    resolveId: (src) => (src === id ? resolved : null),
    load: (src) => (src === resolved ? `export default ${JSON.stringify(listFiles(ASSET_DIR))};` : null),
  };
}

export default defineConfig({
  publicDir: ASSET_DIR,
  plugins: [assetList()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
