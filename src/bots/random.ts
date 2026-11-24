// Random bot (SPEC E1): every 3 s one random affordable action (buy fish, level, carriage,
// slot, decor, track, move fish, upgrade; Depot Reset 50% when available), feeds a random
// carriage every 3 s and taps 50% of Sights.
import type { LineId } from '../data/schema';
import type { Action, Sim } from '../sim';
import { buildIndex, habitatsForLine } from '../sim/lookup';
import { botRng } from './rng';
import { canDo, decorPlacement, trayDecor } from './util';
import type { Bot, BotOptions } from './types';

const STEP = 3;

export function createRandomBot(opts: BotOptions): Bot {
  const idx = buildIndex(opts.data, opts.story);
  const rng = botRng(opts.seed);
  let lastSight = -1;

  /** One random affordable action: categories in random order, first non-empty one wins
   *  (= uniform over non-empty categories), then uniform within it. */
  function randomAction(sim: Sim): Action | undefined {
    const cats = categories(sim);
    for (let i = cats.length - 1; i > 0; i--) { const j = rng.int(i + 1); [cats[i], cats[j]] = [cats[j]!, cats[i]!]; }
    for (const make of cats) {
      const list = make().filter((a) => canDo(sim, a));
      if (list.length) return rng.pick(list);
    }
    return undefined;
  }

  function categories(sim: Sim): (() => Action[])[] {
    const s = sim.state;
    const cats: (() => Action[])[] = [];
    const free = s.carriages.filter((c) => c.fish.length < c.slots);
    const species = [...new Set([...s.speciesBoughtThisRun, ...s.market.fish])];
    const fishIds = Object.keys(s.fish);
    cats.push(() => species.flatMap((sp) => free.map((c): Action => ({ type: 'buyFish', species: sp, carId: c.id }))));
    cats.push(() => fishIds.map((id): Action => ({ type: 'levelFish', fishId: id, times: 1 })));
    cats.push(() => habitatsForLine(idx, s.currentLine).map((h): Action => ({ type: 'buyCarriage', habitat: h })));
    cats.push(() => s.carriages.map((c): Action => ({ type: 'buySlot', carId: c.id })));
    cats.push(() => {
      const decor: Action[] = [];
      const x = decorPlacement(rng.next());
      for (const id of trayDecor(s)) for (const c of s.carriages) decor.push({ type: 'placeDecor', carId: c.id, decorId: id, ...x });
      for (const id of new Set([...s.market.decor, ...Object.keys(s.decorOwned)])) decor.push({ type: 'buyDecor', decorId: id });
      return decor;
    });
    cats.push(() => [{ type: 'buildTrack' }]);
    cats.push(() => fishIds.flatMap((id) => free.filter((c) => c.id !== s.fish[id]?.carId).map((c): Action => ({ type: 'moveFish', fishId: id, carId: c.id }))));
    cats.push(() => idx.data.upgrades.map((u): Action => ({ type: 'buyUpgrade', id: u.id })));
    return cats;
  }

  function resetAction(sim: Sim): Action | null {
    const s = sim.state;
    const fishIds = Object.keys(s.fish);
    const mascot = rng.pick(fishIds);
    const line = rng.pick(s.permanent.openedLines) as LineId | undefined;
    if (!mascot || !line) return null;
    return { type: 'depotReset', mascotFishId: mascot, nextLine: line };
  }

  return {
    name: 'random',
    decide(sim, t) {
      const s = sim.state;
      const out: Action[] = [];
      const sight = s.sight.active;
      if (sight && sight.requiresTap && sight.startedAt !== lastSight) {
        lastSight = sight.startedAt;
        // A tap (Stowaway) can fill a slot, so nothing else is planned this second.
        if (rng.chance(0.5) && canDo(sim, { type: 'tapSight' })) return [{ type: 'tapSight' }];
      }
      if (t % STEP !== 0) return out;
      const car = rng.pick(s.carriages);
      if (car && canDo(sim, { type: 'feed', carId: car.id })) out.push({ type: 'feed', carId: car.id });
      if (sim.canDepotReset() && rng.chance(0.5)) {
        const r = resetAction(sim);
        if (r) { out.push(r); return out; }
      }
      const a = randomAction(sim);
      if (a) out.push(a);
      return out;
    },
  };
}
