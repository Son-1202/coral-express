// Save versioning + migration. Bump SAVE_VERSION in types.ts and add a step here.
import { SAVE_VERSION, type SaveData } from './types';

export function migrateSave(save: SaveData): SaveData {
  if (!save || typeof save !== 'object' || !save.state) throw new Error('sim: invalid save');
  if (save.version > SAVE_VERSION) throw new Error(`sim: save version ${save.version} is newer than ${SAVE_VERSION}`);
  // Deep copy so the caller's object is never mutated by the running sim.
  const out = JSON.parse(JSON.stringify(save)) as SaveData;
  // (no migrations yet: version 1 is the first format)
  out.version = SAVE_VERSION;
  out.state.version = SAVE_VERSION;
  return out;
}
