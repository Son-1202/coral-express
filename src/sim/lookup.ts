// Indexed, read-only view of GameData used by every sim module.
import type {
  DecorEffect, DecorPool, GameData, Habitat, LineDef, LineId, SpeciesDef, UpgradeDef,
} from '../data/schema';

/** Decor items and plain plant sprites share one shape for placement/appeal. */
export interface DecorLike {
  id: string;
  pool: DecorPool;
  baseCost: number | null;
  capacity: number;
  appeal: number;
  effects: DecorEffect[];
}

export interface DataIndex {
  data: GameData;
  species: Map<string, SpeciesDef>;
  decor: Map<string, DecorLike>;
  lines: Map<LineId, LineDef>;
  upgrades: Map<string, UpgradeDef>;
  /** Highest line id (its terminal triggers the ending). */
  maxLine: LineId;
}

export function buildIndex(data: GameData): DataIndex {
  const species = new Map(data.species.map((s) => [s.id, s] as const));
  const decor = new Map<string, DecorLike>();
  for (const d of data.decor) {
    decor.set(d.id, { id: d.id, pool: d.pool, baseCost: d.baseCost, capacity: d.capacity, appeal: d.appeal, effects: d.effects });
  }
  // Plant sprites that are not already a decor item are placeable as +appeal decor.
  for (const p of data.plants) {
    if (p.decorId || decor.has(p.id)) continue;
    decor.set(p.id, { id: p.id, pool: p.pool, baseCost: p.baseCost, capacity: p.capacity, appeal: p.appeal, effects: [] });
  }
  const lines = new Map(data.lines.map((l) => [l.id, l] as const));
  const upgrades = new Map(data.upgrades.map((u) => [u.id, u] as const));
  const maxLine = data.lines.reduce<LineId>((m, l) => (l.id > m ? l.id : m), 1);
  return { data, species, decor, lines, upgrades, maxLine };
}

export function lineDef(idx: DataIndex, line: LineId): LineDef {
  const l = idx.lines.get(line);
  if (!l) throw new Error(`sim: unknown line ${line}`);
  return l;
}

export function stationId(line: LineId, station: number): string {
  return `l${line}s${station}`;
}

/** Habitats selectable on a line: its own plus every earlier line's. */
export function habitatsForLine(idx: DataIndex, line: LineId): Habitat[] {
  const out: Habitat[] = [];
  for (const l of idx.data.lines) {
    if (l.id > line) continue;
    for (const h of l.habitats) if (!out.includes(h)) out.push(h);
  }
  return out;
}

/** Decor pool → line number (reward pool = 0, never sold). */
export function poolLine(pool: DecorPool): number {
  return pool === 'l1' ? 1 : pool === 'l2' ? 2 : pool === 'l3' ? 3 : 0;
}
