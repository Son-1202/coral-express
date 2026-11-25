// Painted UI art (T-26): postcards, Line covers, Wren's portrait and pixel icons.
// Pure resolvers take an injectable `exists` (node-testable, like offline.awayArt);
// `paintedImg` builds a lazy <img> inside a fixed-aspect box so panels never jump,
// with webp → png → procedural fallback.
import { fileUrl, hasFile } from '../assets';
import { h } from './dom';
import './art.css';

type Exists = (path: string) => boolean;

/** `ui/postcard_<stationId>` (png path; the webp twin is preferred when loading) or null. */
export function postcardArt(stationId: string, exists: Exists = hasFile): string | null {
  const p = `/ui/postcard_${stationId}.png`;
  return exists(p) ? p : null;
}

/** `ui/line_cover_<n>` or null. */
export function lineCoverArt(line: number, exists: Exists = hasFile): string | null {
  const p = `/ui/line_cover_${line}.png`;
  return exists(p) ? p : null;
}

/** Wren's portrait (tutorial tips) or null. */
export function wrenArt(exists: Exists = hasFile): string | null {
  const p = '/ui/wren_portrait.png';
  return exists(p) ? p : null;
}

/** Pixel icon `icons/<name>.png` (shell, ticket, stamp, tab_market, upgrade_<id>, …) or null. */
export function iconArt(name: string, exists: Exists = hasFile): string | null {
  const p = `/icons/${name}.png`;
  return exists(p) ? p : null;
}

/** Candidate URLs for a png path: the webp twin first (when shipped), then the png. */
export function artSources(path: string, exists: (p: string) => boolean): string[] {
  const webp = path.replace(/\.png$/, '.webp');
  const out: string[] = [];
  if (webp !== path && exists(webp)) out.push(webp);
  if (exists(path)) out.push(path);
  return out;
}

const shipped = (p: string): boolean => hasFile(p) && fileUrl(p) === p;

/**
 * Fixed-aspect art box (`span.ui-art` + extra classes) with a lazy <img> that fills it
 * (object-fit: cover). If the file is missing or fails to load, `fallback()` is shown instead.
 */
export function paintedImg(path: string | null, cls: string, fallback: () => HTMLElement, opts: { pixel?: boolean; eager?: boolean } = {}): HTMLElement {
  const box = h(`span.ui-art${cls ? '.' + cls.split(' ').join('.') : ''}`);
  const srcs = path ? artSources(path, shipped) : [];
  if (!srcs.length) {
    box.classList.add('ph');
    box.append(fallback());
    return box;
  }
  // `loading` must be set before `src`: a detached <img> starts fetching as soon as src is set.
  const img = h('img', { loading: opts.eager ? 'eager' : 'lazy', decoding: 'async', alt: '', draggable: 'false', src: srcs[0] });
  if (opts.pixel) img.classList.add('px');
  let i = 0;
  img.addEventListener('error', () => {
    i++;
    if (i < srcs.length) img.src = srcs[i];
    else {
      box.classList.add('ph');
      img.replaceWith(fallback());
    }
  });
  box.append(img);
  return box;
}

/** Small pixel icon <img> (no box), or null when the icon file is missing. */
export function iconImg(name: string, cls = 'ui-ico'): HTMLImageElement | null {
  const p = iconArt(name);
  if (!p) return null;
  return h(`img.${cls}`, { loading: 'lazy', decoding: 'async', alt: '', draggable: 'false', src: fileUrl(p) });
}

/** Procedural sky/sea/sand postcard block (only when no painting exists). */
export function postcardPh(line: number): HTMLElement {
  return h('i.ui-art-ph', { 'data-line': line });
}

/** Line card cover: the painted `ui/line_cover_<n>` (locked = desaturated under a lock tag). */
export function lineCover(line: number, open: boolean): HTMLElement {
  const box = paintedImg(lineCoverArt(line), 'ui-line-art', () => postcardPh(line));
  if (!open) box.append(h('b.ui-line-lock', { text: 'Locked' }));
  return box;
}

/** Toast icon: a tiny painted card (postcard / Line cover) or a station stamp crop. */
export function toastArt(path: string | null, line: number, cls = 'ui-toast-art'): HTMLElement {
  return paintedImg(path, cls, () => postcardPh(line));
}

/**
 * Inline currency glyphs (`SHELL` / `TICKET` HTML in panels, buttons, dialogs) are CSS boxes;
 * when the pixel icons exist, expose them as CSS variables + `has-ico-*` classes on `root`.
 */
export function applyIconVars(root: HTMLElement, exists?: (p: string) => boolean): void {
  for (const name of ['shell', 'ticket', 'stamp']) {
    const p = exists ? iconArt(name, exists) : iconArt(name);
    if (!p) continue;
    root.style.setProperty(`--ico-${name}`, `url("${fileUrl(p)}")`);
    root.classList.add(`has-ico-${name}`);
  }
}
