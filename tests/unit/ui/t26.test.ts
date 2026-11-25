import { describe, expect, it } from 'vitest';
import { artSources, iconArt, lineCoverArt, postcardArt, wrenArt } from '../../../src/ui/art';
import { iconHtml } from '../../../src/ui/hud';
import { STATIONS } from '../../../src/ui/content';
import { hasFile } from '../../../src/assets';

const only = (...files: string[]) => (p: string) => files.includes(p) || files.includes(p.replace(/\.png$/, '.webp'));

describe('T-26 painted UI art resolvers', () => {
  it('postcard / line cover / wren / icon paths resolve when the file exists, else null (procedural)', () => {
    expect(postcardArt('l2s3', only('/ui/postcard_l2s3.webp'))).toBe('/ui/postcard_l2s3.png');
    expect(postcardArt('l2s3', only())).toBeNull();
    expect(lineCoverArt(3, only('/ui/line_cover_3.png'))).toBe('/ui/line_cover_3.png');
    expect(lineCoverArt(2, only('/ui/line_cover_3.png'))).toBeNull();
    expect(wrenArt(only('/ui/wren_portrait.png'))).toBe('/ui/wren_portrait.png');
    expect(iconArt('tab_market', only('/icons/tab_market.png'))).toBe('/icons/tab_market.png');
    expect(iconArt('tab_market', only())).toBeNull();
  });

  it('prefers the webp twin, falls back to png, then nothing', () => {
    const both = (p: string) => ['/ui/a.webp', '/ui/a.png'].includes(p);
    expect(artSources('/ui/a.png', both)).toEqual(['/ui/a.webp', '/ui/a.png']);
    expect(artSources('/ui/a.png', (p) => p === '/ui/a.png')).toEqual(['/ui/a.png']);
    expect(artSources('/ui/a.png', (p) => p === '/ui/a.webp')).toEqual(['/ui/a.webp']);
    expect(artSources('/ui/a.png', () => false)).toEqual([]);
  });

  it('every station has its shipped postcard painting, and all three Line covers exist', () => {
    for (const s of STATIONS) expect(postcardArt(s.id), s.id).toBe(`/ui/postcard_${s.id}.png`);
    for (const l of [1, 2, 3]) expect(lineCoverArt(l)).not.toBeNull();
    expect(wrenArt()).not.toBeNull();
    for (const n of ['shell', 'ticket', 'tab_market', 'tab_track', 'tab_stamps', 'tab_depot']) expect(hasFile(`/icons/${n}.png`), n).toBe(true);
  });

  it('HUD icons use the pixel art when present, procedural markup otherwise', () => {
    expect(iconHtml('shell', '<i class="shell"></i>', only('/icons/shell.png'))).toContain('src="');
    expect(iconHtml('shell', '<i class="shell"></i>', only())).toBe('<i class="shell"></i>');
  });
});
