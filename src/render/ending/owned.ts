/** Owned species → ending panorama cast (pure). */
import type { SpeciesDef } from '../../data/schema';
import type { EndingFish } from './underwater';

interface FishLike {
  species: string;
  shiny: boolean;
}

/** One entry per owned species (shiny if any owned copy is shiny), in species.json order. */
export function ownedSpecies(fish: Record<string, FishLike> | readonly FishLike[], species: readonly SpeciesDef[]): EndingFish[] {
  const list = Array.isArray(fish) ? fish : Object.values(fish);
  const shiny = new Map<string, boolean>();
  for (const f of list) shiny.set(f.species, (shiny.get(f.species) ?? false) || f.shiny);
  return species.filter((s) => shiny.has(s.id)).map((s) => ({ species: s.id, motion: s.motion, shiny: shiny.get(s.id) }));
}

/** One carriage on the ending beach: habitat interior + the fish living in it. */
export interface EndingCar {
  habitat: string;
  fish: EndingFish[];
}

interface CarLike {
  habitat: string;
  fish: readonly string[];
}

/** The player's carriages (sim order: index 0 sits right behind the locomotive), max 8. */
export function endingCars(
  carriages: readonly CarLike[],
  fish: Record<string, FishLike>,
  species: readonly Pick<SpeciesDef, 'id' | 'motion'>[],
): EndingCar[] {
  const motion = new Map(species.map((s) => [s.id, s.motion] as const));
  return carriages.slice(0, 8).map((c) => ({
    habitat: c.habitat,
    fish: c.fish
      .map((id) => fish[id])
      .filter((f): f is FishLike => !!f && motion.has(f.species))
      .map((f) => ({ species: f.species, motion: motion.get(f.species) ?? 'darter', shiny: f.shiny })),
  }));
}
