import { SUNNY } from '../paint/palette';

/**
 * Per-Line foreground palette (QA bug 4): the garden, embankment wall and near
 * strip in front of the track take each Line's materials. Art direction only.
 */
export interface ForeStyle {
  grass: string;
  grassDark: string;
  grassLight: string;
  specks: string[];
  path: string;
  pathSpecks: string[];
  wallBase: string;
  stones: string[];
  /** Stone shape for the embankment wall. */
  wall: 'ashlar' | 'boulder' | 'lava';
  moss: string;
  leaf: string;
  leafDark: string;
  leafLight: string;
  flowers: string[];
  wood: string;
  woodDark: string;
}

export const FORE_STYLE: Record<number, ForeStyle> = {
  1: {
    grass: SUNNY.grass,
    grassDark: SUNNY.grassDark,
    grassLight: SUNNY.grassLight,
    specks: [SUNNY.grassDark, SUNNY.grassLight, '#9bcb6c', '#7bb558'],
    path: '#e8d7b0',
    pathSpecks: ['#d8c59c', '#f2e5c4'],
    wallBase: SUNNY.stoneDark,
    stones: [SUNNY.stone, '#e3d1b0', '#c9b28d'],
    wall: 'ashlar',
    moss: SUNNY.grassDark,
    leaf: SUNNY.leaf,
    leafDark: SUNNY.leafDark,
    leafLight: SUNNY.leafLight,
    flowers: [...SUNNY.flowers],
    wood: SUNNY.wood,
    woodDark: SUNNY.woodDark,
  },
  // Fog Fjords: mossy granite, ferns, lupins, weathered wooden fence
  2: {
    grass: '#6f9a58',
    grassDark: '#4c7442',
    grassLight: '#93b971',
    specks: ['#4c7442', '#93b971', '#5f8a4d', '#a8c487'],
    path: '#a7a59b',
    pathSpecks: ['#8d8b82', '#c2c0b6', '#7a7a73'],
    wallBase: '#5c6366',
    stones: ['#8d969a', '#7b8488', '#a2aaad', '#6e777b'],
    wall: 'boulder',
    moss: '#6f9a3f',
    leaf: '#4f7f45',
    leafDark: '#355e36',
    leafLight: '#7aa85e',
    flowers: ['#9a6fd0', '#c58ad8', '#e5a3c4', '#f4f1e8', '#7d5bbf'],
    wood: '#8a6a4f',
    woodDark: '#5a4535',
  },
  // Volcano Isles: black lava rock, hibiscus, bamboo
  3: {
    grass: '#6fae4f',
    grassDark: '#3f7d3a',
    grassLight: '#9ccc68',
    specks: ['#3f7d3a', '#9ccc68', '#579845', '#2f6431'],
    path: '#3b3634',
    pathSpecks: ['#2a2625', '#55504c', '#6a5f58'],
    wallBase: '#1f1c1d',
    stones: ['#3a3536', '#2e2a2b', '#4a4344', '#423a3a'],
    wall: 'lava',
    moss: '#4f8a3c',
    leaf: '#3f8a46',
    leafDark: '#2a633a',
    leafLight: '#6cb257',
    flowers: ['#e43a35', '#ff5a4a', '#f7b733', '#ff8a5a', '#d62f5f'],
    wood: '#d8b46a',
    woodDark: '#9c7a3e',
  },
};

export function foreStyle(line: number): ForeStyle {
  return FORE_STYLE[line] ?? (FORE_STYLE[1] as ForeStyle);
}
