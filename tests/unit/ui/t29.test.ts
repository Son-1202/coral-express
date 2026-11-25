import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { decorArt, sightArt } from '../../../src/ui/art';
import { iconHtml } from '../../../src/ui/hud';

const data = loadGameData();
const ASSETS = resolve(__dirname, '../../../assets');
/** Real shipped files (public dir), like the build-time asset list (no `_*` working dirs). */
const onDisk = (p: string): boolean => !p.split('/')[1]?.startsWith('_') && existsSync(join(ASSETS, p));
const only = (...files: string[]) => (p: string) => files.includes(p);

describe('T-29 decor / plant thumbnails', () => {
  it('every decor id and plant id resolves to an existing image file', () => {
    const ids = [...data.decor.map((d) => d.id), ...data.plants.map((p) => p.id)];
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      const p = decorArt(data, id, onDisk);
      expect(p, id).not.toBeNull();
      expect(existsSync(join(ASSETS, p!)), `${id} → ${p}`).toBe(true);
    }
  });

  it('plant-decor uses its linked plant sprite (plants.json ↔ decor.json), plain decor its own file', () => {
    for (const d of data.decor.filter((x) => x.isPlant)) {
      expect(d.plantId, d.id).toBeTruthy();
      expect(data.plants.find((p) => p.id === d.plantId)?.decorId, d.id).toBe(d.id);
      expect(decorArt(data, d.id, onDisk)).toBe(`/plants/${d.plantId}.png`);
    }
    expect(decorArt(data, 'seagrass_tuft', only('/plants/reef_3.png'))).toBe('/plants/reef_3.png');
    expect(decorArt(data, 'mangrove_3', only('/plants/mangrove_3.png'))).toBe('/plants/mangrove_3.png');
    expect(decorArt(data, 'coral_castle', only('/decor/coral_castle.png'))).toBe('/decor/coral_castle.png');
    expect(decorArt(data, 'coral_castle', only())).toBeNull();
  });

  it('sight toasts map to the sight sprites', () => {
    expect(sightArt('dolphin_race', only('/sights/dolphin.png'))).toBe('/sights/dolphin.png');
    expect(sightArt('sea_fog', only('/sights/dolphin.png'))).toBeNull();
  });

  it('Shells/s HUD icon: painted icon when shipped, procedural dot otherwise', () => {
    expect(iconHtml('shells_per_sec', '<i class="wave"></i>', only('/icons/shells_per_sec.png'))).toContain('/icons/shells_per_sec.png');
    expect(iconHtml('shells_per_sec', '<i class="wave"></i>', only())).toBe('<i class="wave"></i>');
  });
});
