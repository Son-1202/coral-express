/** Dev-only demo game for zoo.html's tank modes (not imported by the shipped game). */
import { loadGameData } from '../../data/schema';
import { createSimInternal } from '../../sim';
import { spawnFish } from '../../sim/actionsFish';
import type { TankApi } from './types';

export function demoApi(): TankApi {
  const data = loadGameData();
  const { sim, ctx } = createSimInternal(data, { seed: 7 });
  const s = sim.state;
  const car = s.carriages[0];
  if (!car) throw new Error('demo: no carriage');
  car.slots = 8;
  for (const sp of ['clownfish', 'carpet_anemone', 'pebble_damsel', 'pistol_shrimp', 'mudskipper', 'kelp_seahorse']) spawnFish(ctx, sp, car.id, { level: 12, shiny: sp === 'clownfish' });
  const first = s.fish[car.fish[2] ?? ''];
  if (first) first.mascot = true;
  for (const id of ['sea_fan', 'seagrass_tuft', 'treasure_chest', 'coral_castle', 'sea_glass', 'reef_2', 'reef_4', 'mangrove_root']) s.decorOwned[id] = (s.decorOwned[id] ?? 0) + 2;
  ctx.invalidate();
  ctx.refreshBonds();
  const place = (decorId: string, x: number, y: number, layer: 'back' | 'front', flip = false) =>
    sim.act({ type: 'placeDecor', carId: car.id, decorId, x, y, layer, scale: 1, flip });
  place('coral_castle', 0.22, 0.161, 'back');
  place('sea_fan', 0.62, 0.161, 'back');
  place('seagrass_tuft', 0.1, 0.07, 'front');
  place('reef_2', 0.78, 0.07, 'front', true);
  s.shells = 1e9;
  return { data, state: () => sim.state, act: (a) => sim.act(a), carInfo: (id) => sim.carInfo(id) };
}
