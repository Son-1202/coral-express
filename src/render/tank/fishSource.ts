/**
 * Pure fish-sprite URL selection for Tank View (import-free so unit tests need no Vite virtuals).
 * Shiny fish prefer their own `_shiny` art (final path, then the ART pipeline's `_cut/` folder);
 * without it they fall back to the normal sprite with a procedural tint (`tint: true`).
 */
export interface FishSource {
  /** First existing URL, or null when no art exists (procedural placeholder). */
  url: string | null;
  /** Apply the procedural shiny tint to the loaded image (shiny fish without own art). */
  tint: boolean;
}

export const fishUrls = (id: string, shiny = false): string[] => {
  const n = shiny ? `${id}_shiny` : id;
  return [`/fish/${n}.png`, `/_cut/fish/${n}.png`];
};

export function fishSource(id: string, shiny: boolean, exists: (url: string) => boolean): FishSource {
  const first = (c: string[]) => c.find((u) => exists(u)) ?? null;
  if (shiny) {
    const own = first(fishUrls(id, true));
    if (own) return { url: own, tint: false };
    return { url: first(fishUrls(id)), tint: true };
  }
  return { url: first(fishUrls(id)), tint: false };
}
