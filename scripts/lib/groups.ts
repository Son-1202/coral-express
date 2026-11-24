/**
 * Asset group classification shared by `pixelize.ts` and `optimize-assets.ts`.
 * Paths are relative to `assets/` (or `assets/_cut/`), forward slashes, e.g. `fish/krill.png`.
 */

/** How the target size is measured: longest side, height, or width (px). */
export type SizeMode = 'long' | 'height' | 'width';

export interface SpriteRule {
  kind: 'sprite';
  group: string;
  size: number;
  mode: SizeMode;
}

export interface PainterlyRule {
  kind: 'painterly';
  group: string;
  maxWidth: number;
}

export type AssetRule = SpriteRule | PainterlyRule;

/** Set to false to treat stations as painterly layers (optimize-assets) instead of pixel sprites. */
export const PIXELIZE_STATIONS = true;

/** Fish whose sprite size differs from the 64 px default (shiny variants inherit). */
const FISH_SIZES: Record<string, number> = { pocket_whale: 96, ghost_ray: 80, krill: 56 };
const SIGHT_SIZES: Record<string, number> = { whale: 160 };
export const DEFAULT_SPRITE_SIZE = 64;

const sprite = (group: string, size: number, mode: SizeMode = 'long'): SpriteRule => ({ kind: 'sprite', group, size, mode });
const painterly = (group: string, maxWidth: number): PainterlyRule => ({ kind: 'painterly', group, maxWidth });

function baseName(rel: string): string {
  const file = rel.split('/').pop() ?? rel;
  return file.replace(/\.[a-z0-9]+$/i, '');
}

/** Classify an asset path. Unknown paths are 64 px sprites. */
export function classify(relPath: string): AssetRule {
  const rel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const dir = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '';
  const name = baseName(rel);

  if (/^style_bible/.test(name)) return painterly('style_bible', 1920);

  switch (dir) {
    case 'fish': {
      const id = name.replace(/_shiny$/, '');
      return sprite('fish', FISH_SIZES[id] ?? 64);
    }
    case 'plants':
      return sprite('plants', 72, 'height');
    case 'decor':
      return sprite('decor', 64);
    case 'passengers':
      return sprite('passengers', 48, 'height');
    case 'wildlife':
      return sprite('wildlife', 64);
    case 'sights':
      return sprite('sights', SIGHT_SIZES[name] ?? 80);
    case 'icons':
      return sprite('icons', 32);
    case 'station':
      return PIXELIZE_STATIONS ? sprite('station', 384, 'width') : painterly('station', 1920);
    case 'scenery':
      if (/_props_/.test(name)) return sprite('props', 96);
      if (/_foliage_/.test(name)) return sprite('foliage', 96);
      return painterly('scenery', 2560);
    case 'train':
      if (name === 'wheel') return sprite('wheel', 32);
      if (name === 'rod') return sprite('rod', 48);
      if (name === 'locomotive') return sprite('locomotive', 320, 'width');
      if (name === 'car_shell') return sprite('car_shell', 288, 'width');
      if (/^(interior|backdrop)_/.test(name)) return painterly('interior', 1280);
      break;
    case 'ui':
      if (/keyart/.test(name)) return painterly('keyart', 1920);
      if (/^postcard_/.test(name)) return painterly('postcard', 960);
      if (/^line_cover_/.test(name)) return painterly('line_cover', 1920);
      if (/^(icon_|upgrade_|tab_)/.test(name) || ['shell', 'ticket', 'stamp'].includes(name)) return sprite('icons', 32);
      if (/^(photo_frames_|wren_portrait)/.test(name)) return painterly('ui', 1280);
      break;
  }
  return sprite('unknown', DEFAULT_SPRITE_SIZE);
}
