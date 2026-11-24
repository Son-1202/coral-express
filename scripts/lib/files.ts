/** File helpers for the asset scripts: glob listing, write-if-changed, table printing. */
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, sep } from 'node:path';

export const toPosix = (p: string): string => p.split(sep).join('/');

/**
 * List image files under `root`. `patterns` are globs relative to `root` (e.g. `fish/*.png`);
 * a pattern without glob characters matches a directory prefix or exact file. Sorted for determinism.
 */
export function listImages(root: string, patterns: string[], exts = ['png', 'webp', 'jpg', 'jpeg']): string[] {
  if (!existsSync(root)) return [];
  const extRe = new RegExp(`\\.(${exts.join('|')})$`, 'i');
  const globs = patterns.length === 0
    ? ['**/*']
    : patterns.map((p) => {
        const q = toPosix(p).replace(/^\.?\/+/, '');
        return /[*?[{]/.test(q) || extRe.test(q) ? q : `${q.replace(/\/+$/, '')}/**/*`;
      });
  const found = new Set<string>();
  for (const g of globs) {
    for (const f of globSync(g, { cwd: root })) {
      const rel = toPosix(f);
      if (extRe.test(rel) && !rel.split('/').some((s) => s.startsWith('_'))) found.add(rel);
    }
  }
  return [...found].sort();
}

/** Write `buf` to `path` only if content differs. Returns 'new' | 'updated' | 'unchanged'. */
export function writeIfChanged(path: string, buf: Buffer): 'new' | 'updated' | 'unchanged' {
  if (existsSync(path)) {
    if (readFileSync(path).equals(buf)) return 'unchanged';
    writeFileSync(path, buf);
    return 'updated';
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return 'new';
}

export function printTable(rows: Record<string, string | number>[]): void {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join('  ');
  console.log(line(cols));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const r of rows) console.log(line(cols.map((c) => String(r[c] ?? ''))));
}
