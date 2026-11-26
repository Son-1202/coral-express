import { describe, expect, it } from 'vitest';
import { iconArt, sightArt } from '../../../src/ui/art';

const only = (...paths: string[]) => (p: string) => paths.includes(p);

describe('T-40: T-39 icons with procedural fallback', () => {
  it('icon-only Sights use their pixel icon', () => {
    expect(sightArt('festival_station', only('/icons/sight_festival.png'))).toBe('/icons/sight_festival.png');
    expect(sightArt('stowaway', only('/icons/sight_stowaway.png'))).toBe('/icons/sight_stowaway.png');
    expect(sightArt('sea_fog', only('/icons/sight_seafog.png'))).toBe('/icons/sight_seafog.png');
  });
  it('falls back to null (procedural) when the icon is missing', () => {
    expect(sightArt('sea_fog', only())).toBeNull();
    expect(iconArt('feed', only())).toBeNull();
    expect(iconArt('tankview', only('/icons/tankview.png'))).toBe('/icons/tankview.png');
  });
});
