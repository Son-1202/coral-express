/**
 * pixelize.ts — turn ART's hi-res cutouts into crisp game pixel sprites.
 *
 * Usage:
 *   npx tsx scripts/pixelize.ts                     # every sprite under assets/_cut/**
 *   npx tsx scripts/pixelize.ts fish 'plants/*.png' # globs / dir prefixes relative to assets/_cut
 *   npx tsx scripts/pixelize.ts --in tmp/cut --out tmp/out [globs...]   # custom roots
 *   flags: --colors N (palette size, default 32), --dry (classify only, write nothing)
 *
 * Input:  assets/_cut/<path>.png  (RGBA cutout, alpha = silhouette, ≤768 px long side)
 * Output: assets/<path>.png       (same relative path)
 *
 * Steps per sprite (scripts/lib/pixel.ts): trim transparent border → exact area-average
 * downscale (alpha-weighted, so no colour bleed) to target-2 px → alpha threshold at 0.5
 * (kills halos) → median-cut quantize (32 colours, transparency kept) → 1 px 4-connected
 * outline (darkened neighbour colour mixed 50% toward #1d1a2a) → PNG.
 * Target sizes per group live in scripts/lib/groups.ts (final measured side == target).
 * Painterly paths (scenery layers, interiors, backdrops, key art, postcards…) are skipped —
 * use scripts/optimize-assets.ts for those. Deterministic and idempotent (unchanged files
 * are not rewritten).
 */
import sharp from 'sharp';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classify, type SpriteRule } from './lib/groups';
import { listImages, printTable, writeIfChanged } from './lib/files';
import { pixelizeImage, type Rgba } from './lib/pixel';

export async function readRgba(path: string): Promise<Rgba> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

export async function encodePng(img: Rgba): Promise<Buffer> {
  return sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
}

export interface PixelizeResult {
  file: string;
  group: string;
  src: string;
  out: string;
  colors: number;
  status: string;
}

/** Pixelize one file. `rule` defaults to the classification of `relPath`. */
export async function pixelizeFile(inPath: string, outPath: string, rule: SpriteRule, colors = 32): Promise<Omit<PixelizeResult, 'file'>> {
  const src = await readRgba(inPath);
  const { image, colors: used } = pixelizeImage(src, { size: rule.size, mode: rule.mode, colors });
  const status = writeIfChanged(outPath, await encodePng(image));
  return {
    group: `${rule.group} (${rule.size}${rule.mode === 'long' ? '' : ' ' + rule.mode})`,
    src: `${src.width}x${src.height}`,
    out: `${image.width}x${image.height}`,
    colors: used,
    status,
  };
}

function parseArgs(argv: string[]) {
  const out = { inDir: 'assets/_cut', outDir: 'assets', colors: 32, dry: false, globs: [] as string[] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') out.inDir = argv[++i];
    else if (a === '--out') out.outDir = argv[++i];
    else if (a === '--colors') out.colors = Number(argv[++i]);
    else if (a === '--dry') out.dry = true;
    else out.globs.push(a);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inDir = resolve(args.inDir), outDir = resolve(args.outDir);
  const files = listImages(inDir, args.globs, ['png', 'webp']);
  if (files.length === 0) {
    console.log(`pixelize: no input images in ${args.inDir} matching ${args.globs.join(' ') || '**'}`);
    return;
  }
  const rows: PixelizeResult[] = [];
  let skipped = 0;
  for (const file of files) {
    const rule = classify(file);
    if (rule.kind !== 'sprite') { skipped++; continue; }
    const outRel = file.replace(/\.[a-z]+$/i, '.png');
    if (args.dry) {
      rows.push({ file, group: rule.group, src: '', out: `${rule.size} ${rule.mode}`, colors: 0, status: 'dry' });
      continue;
    }
    rows.push({ file, ...(await pixelizeFile(join(inDir, file), join(outDir, outRel), rule, args.colors)) });
  }
  printTable(rows.map((r) => ({ ...r })));
  console.log(`\npixelize: ${rows.length} sprite(s) → ${args.outDir}` + (skipped ? `, ${skipped} painterly file(s) skipped (use optimize-assets.ts)` : ''));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err: unknown) => { console.error(err); process.exit(1); });
}
