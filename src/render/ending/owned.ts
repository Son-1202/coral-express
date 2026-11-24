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
