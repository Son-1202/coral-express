// Test helpers: scripted sims that bypass market availability and give Shells.
import { loadGameData } from '../../../src/data/schema';
import type { GameData, Habitat, LineId } from '../../../src/data/schema';
import { createSimInternal, type SimInternals, type StoryData } from '../../../src/sim';
import requestsJson from '../../../src/story/requests.json';

export const data: GameData = loadGameData();
export const story = requestsJson as StoryData;

export function make(seed = 1, withStory = false): SimInternals {
  return createSimInternal(data, withStory ? { seed, story } : { seed });
}

/** Put decor ids on the open market's decor stall (test-only). */
export function stock(t: SimInternals, ...decorIds: string[]): void {
  t.ctx.state.market.decor.push(...decorIds);
}

/** Never start a Sight (keeps exact-value tests free of random buffs). */
export function noSights(t: SimInternals): void {
  t.ctx.state.sight.nextAt = 1e15;
}

/** Give Shells (not counted as earned). */
export function give(t: SimInternals, n: number): void {
  t.ctx.state.shells += n;
}

/** Mark species as bought this run so they can be bought anywhere. */
export function unlock(t: SimInternals, ...species: string[]): void {
  for (const s of species) if (!t.ctx.state.speciesBoughtThisRun.includes(s)) t.ctx.state.speciesBoughtThisRun.push(s);
}

/** Buy a fish (unlocking + funding it); returns the fish id. */
export function addFish(t: SimInternals, species: string, carId?: string): string {
  unlock(t, species);
  const car = carId ?? t.ctx.state.carriages[0]!.id;
  give(t, t.sim.price({ type: 'buyFish', species, carId: car }) ?? 0);
  const r = t.sim.act({ type: 'buyFish', species, carId: car });
  if (!r.ok) throw new Error(`addFish ${species}: ${r.reason}`);
  const ids = t.ctx.state.carriages.find((c) => c.id === car)!.fish;
  return ids[ids.length - 1]!;
}

export function addCar(t: SimInternals, habitat: Habitat): string {
  give(t, t.sim.price({ type: 'buyCarriage', habitat }) ?? 0);
  const r = t.sim.act({ type: 'buyCarriage', habitat });
  if (!r.ok) throw new Error(`addCar ${habitat}: ${r.reason}`);
  return t.ctx.state.carriages[t.ctx.state.carriages.length - 1]!.id;
}

/** Jump the run to another line (test-only). */
export function setLine(t: SimInternals, line: LineId): void {
  t.ctx.state.currentLine = line;
  if (!t.ctx.state.permanent.openedLines.includes(line)) t.ctx.state.permanent.openedLines.push(line);
  t.ctx.invalidate();
}

export function heritage(t: SimInternals): string {
  return t.ctx.state.carriages[0]!.id;
}
