/**
 * optimize-assets.ts — resize + compress painterly layers (not pixelized).
 *
 * Usage:
 *   npx tsx scripts/optimize-assets.ts                    # all painterly files in assets/_cut
 *   npx tsx scripts/optimize-assets.ts scenery 'ui/postcard_*.png'
 *   npx tsx scripts/optimize-assets.ts --in assets/_raw style_bible_B.png  # raw source (name must match final path)
 *   flags: --quality N (webp quality, default 86), --all (also process sprite-classified files)
 *
 * Source root: assets/_cut/<path> by default; pass `--in <dir>` (repeatable, first match wins)
 * for assets/_raw or a temp dir. _raw isn't a default because it holds unchosen candidates.
 * Output:  assets/<path>.png (palette: false, compressionLevel 9) + assets/<path>.webp (q86).
 * Max widths per group (scripts/lib/groups.ts): scenery 2560, interiors/backdrops 1280,
 * key art / line covers / style bible 1920, postcards 960. Never upscales. Files classified as
 * sprites are skipped (run scripts/pixelize.ts) unless --all. Idempotent (unchanged files are
 * not rewritten).
 */
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classify } from './lib/groups';
import { listImages, printTable, writeIfChanged } from './lib/files';

export async function optimizeFile(inPath: string, outBase: string, maxWidth: number, quality = 86) {
  const input = sharp(inPath);
  const meta = await input.metadata();
  const resized = sharp(inPath).resize({ width: maxWidth, withoutEnlargement: true, kernel: 'lanczos3' });
  const png = await resized.clone().png({ palette: false, compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  const webp = await resized.clone().webp({ quality, effort: 6 }).toBuffer();
  const outMeta = await sharp(png).metadata();
  return {
    src: `${meta.width}x${meta.height}`,
    out: `${outMeta.width}x${outMeta.height}`,
    png: `${(png.length / 1024).toFixed(0)}K ${writeIfChanged(outBase + '.png', png)}`,
    webp: `${(webp.length / 1024).toFixed(0)}K ${writeIfChanged(outBase + '.webp', webp)}`,
  };
}

function parseArgs(argv: string[]) {
  const out = { roots: [] as string[], outDir: 'assets', quality: 86, all: false, globs: [] as string[] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') out.roots.push(argv[++i]);
    else if (a === '--out') out.outDir = argv[++i];
    else if (a === '--quality') out.quality = Number(argv[++i]);
    else if (a === '--all') out.all = true;
    else out.globs.push(a);
  }
  if (out.roots.length === 0) out.roots.push('assets/_cut');
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolve(args.outDir);
  // First root wins for a given output path (_cut over _raw).
  const sources = new Map<string, { root: string; file: string }>();
  for (const root of args.roots) {
    for (const file of listImages(resolve(root), args.globs)) {
      const key = file.replace(/\.[a-z]+$/i, '');
      if (!sources.has(key)) sources.set(key, { root: resolve(root), file });
    }
  }
  const rows: Record<string, string>[] = [];
  for (const [key, { root, file }] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    const rule = classify(file);
    if (rule.kind !== 'painterly' && !args.all) continue;
    const maxWidth = rule.kind === 'painterly' ? rule.maxWidth : 1280;
    const inPath = join(root, file);
    if (!existsSync(inPath)) continue;
    rows.push({ file, group: rule.group, max: String(maxWidth), ...(await optimizeFile(inPath, join(outDir, key), maxWidth, args.quality)) });
  }
  if (rows.length === 0) console.log(`optimize-assets: nothing to do in ${args.roots.join(', ')}`);
  else printTable(rows);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err: unknown) => { console.error(err); process.exit(1); });
}
