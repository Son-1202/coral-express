import { PATHS, hasFile } from '../../assets';

/**
 * Carriage-window interior per habitat. Kelp uses the Kelp Cathedral backdrop:
 * its `interior_kelp` painting reads as a brick/chevron wall at window size (QA bug 8).
 */
const INTERIOR_OVERRIDE: Record<string, string> = { kelp: '/train/backdrop_kelp_1.png' };

export function interiorPath(habitat: string): string {
  const o = INTERIOR_OVERRIDE[habitat];
  return o && hasFile(o) ? o : PATHS.interior(habitat);
}
