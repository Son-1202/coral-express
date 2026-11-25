import { describe, expect, it } from 'vitest';
import { fishSource, fishUrls } from '../../../src/render/tank/fishSource';

const has = (...urls: string[]) => (u: string) => urls.includes(u);

describe('Tank View fish sprite selection (T-27)', () => {
  it('normal fish load the normal sprite', () => {
    expect(fishSource('clownfish', false, has('/fish/clownfish.png', '/fish/clownfish_shiny.png'))).toEqual({ url: '/fish/clownfish.png', tint: false });
  });
  it('shiny fish load their own _shiny art', () => {
    expect(fishSource('clownfish', true, has('/fish/clownfish.png', '/fish/clownfish_shiny.png'))).toEqual({ url: '/fish/clownfish_shiny.png', tint: false });
  });
  it('shiny fish fall back to the _cut shiny art', () => {
    expect(fishSource('clownfish', true, has('/fish/clownfish.png', '/_cut/fish/clownfish_shiny.png'))).toEqual({ url: '/_cut/fish/clownfish_shiny.png', tint: false });
  });
  it('shiny fish without shiny art use the normal sprite with the procedural tint', () => {
    expect(fishSource('garibaldi', true, has('/fish/garibaldi.png'))).toEqual({ url: '/fish/garibaldi.png', tint: true });
  });
  it('no art at all -> placeholder (null url)', () => {
    expect(fishSource('nobody', true, has())).toEqual({ url: null, tint: true });
    expect(fishSource('nobody', false, has())).toEqual({ url: null, tint: false });
  });
  it('fishUrls keeps the final-path-then-_cut order', () => {
    expect(fishUrls('mudskipper')).toEqual(['/fish/mudskipper.png', '/_cut/fish/mudskipper.png']);
    expect(fishUrls('mudskipper', true)).toEqual(['/fish/mudskipper_shiny.png', '/_cut/fish/mudskipper_shiny.png']);
  });
});
