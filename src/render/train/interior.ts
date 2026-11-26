import { PATHS } from '../../assets';

/**
 * Carriage-window interior per habitat. T-40: the T-39 `interior_kelp` (readable kelp forest)
 * replaced the old brick/chevron painting, so kelp no longer borrows the Kelp Cathedral backdrop.
 */
export function interiorPath(habitat: string): string {
  return PATHS.interior(habitat);
}
