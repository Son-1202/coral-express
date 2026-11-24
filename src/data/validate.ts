// Referential-integrity checks for GameData. Pure TS; returns a list of error strings (empty = valid).
import { HABITATS } from './schema';
import type { GameData, Habitat, LineId } from './schema';

const EXPECTED = { species: 18, decor: 14, plants: 20, upgrades: 8, lines: 3, sights: 6, sand: 5, paints: 8 };
const HEX = /^#[0-9a-fA-F]{6}$/;

function dupes(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) out.push(id);
    seen.add(id);
  }
  return out;
}

export function validateGameData(d: GameData): string[] {
  const errs: string[] = [];
  const err = (m: string): void => { errs.push(m); };

  // counts
  const counts: Record<keyof typeof EXPECTED, number> = {
    species: d.species.length, decor: d.decor.length, plants: d.plants.length,
    upgrades: d.upgrades.length, lines: d.lines.length, sights: d.sights.length,
    sand: d.cosmetics.sand.length, paints: d.cosmetics.paints.length,
  };
  for (const k of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    if (counts[k] !== EXPECTED[k]) err(`${k}: expected ${EXPECTED[k]}, got ${counts[k]}`);
  }

  // unique ids
  const idLists: [string, string[]][] = [
    ['species', d.species.map((s) => s.id)],
    ['decor', d.decor.map((x) => x.id)],
    ['plants', d.plants.map((x) => x.id)],
    ['upgrades', d.upgrades.map((x) => x.id)],
    ['sights', d.sights.map((x) => x.id)],
    ['communities', d.bonds.communities.map((x) => x.id)],
    ['cosmetics', [...d.cosmetics.sand, ...d.cosmetics.paints, ...d.cosmetics.backdrops].map((x) => x.id)],
  ];
  for (const [name, ids] of idLists) for (const id of dupes(ids)) err(`${name}: duplicate id ${id}`);

  const speciesIds = new Set(d.species.map((s) => s.id));
  const decorById = new Map(d.decor.map((x) => [x.id, x]));
  const plantById = new Map(d.plants.map((x) => [x.id, x]));
  const lineById = new Map(d.lines.map((l) => [l.id, l]));
  const habitatSet = new Set<string>(HABITATS);

  // config
  const c = d.config;
  if (c.stationMults.length !== c.stationsPerLine) err('config.stationMults length != stationsPerLine');
  if (c.sightInterval[0] > c.sightInterval[1]) err('config.sightInterval min > max');
  if (c.startSlots > c.maxSlots) err('config.startSlots > maxSlots');

  // lines: habitats + opensAfter chain
  const habitatLine = new Map<Habitat, LineId>();
  for (const l of d.lines) {
    for (const h of l.habitats) {
      if (!habitatSet.has(h)) err(`line ${l.id}: unknown habitat ${h}`);
      if (habitatLine.has(h)) err(`habitat ${h} unlocked by more than one line`);
      habitatLine.set(h, l.id);
    }
    if (l.opensAfter !== null && !lineById.has(l.opensAfter)) err(`line ${l.id}: opensAfter ${l.opensAfter} missing`);
  }
  for (const h of HABITATS) if (!habitatLine.has(h)) err(`habitat ${h} not unlocked by any line`);

  // species: line/station slot unique, habitat available on that line
  const slots = new Set<string>();
  for (const s of d.species) {
    const line = lineById.get(s.line);
    if (!line) { err(`species ${s.id}: unknown line ${s.line}`); continue; }
    if (s.station < 1 || s.station > c.stationsPerLine) err(`species ${s.id}: station ${s.station} out of range`);
    const key = `${s.line}:${s.station}`;
    if (slots.has(key)) err(`species ${s.id}: duplicate home station ${key}`);
    slots.add(key);
    if (s.habitat !== 'any') {
      const unlockLine = habitatLine.get(s.habitat);
      if (unlockLine === undefined || unlockLine > s.line) err(`species ${s.id}: habitat ${s.habitat} not unlocked by line ${s.line}`);
    }
    if (s.baseCost <= 0 || s.basePps <= 0 || s.appeal <= 0) err(`species ${s.id}: non-positive numbers`);
  }

  // bonds
  const inPair = new Set<string>();
  for (const p of d.bonds.pairs) {
    for (const id of [p.a, p.b]) {
      if (!speciesIds.has(id)) err(`pair ${p.a}+${p.b}: unknown species ${id}`);
      if (inPair.has(id)) err(`species ${id} appears in more than one pair`);
      inPair.add(id);
    }
    if (p.a === p.b) err(`pair ${p.a}: self-pair`);
  }
  for (const cm of d.bonds.communities) {
    if (cm.members.length !== 3 || new Set(cm.members).size !== 3) err(`community ${cm.id}: needs 3 distinct members`);
    for (const id of cm.members) if (!speciesIds.has(id)) err(`community ${cm.id}: unknown species ${id}`);
  }

  // decor
  for (const x of d.decor) {
    if (x.pool === 'reward' ? x.baseCost !== null : x.baseCost === null) err(`decor ${x.id}: baseCost/pool mismatch`);
    if (x.isPlant) {
      if (!x.sway) err(`decor ${x.id}: plant missing sway`);
      if (!x.plantId) err(`decor ${x.id}: plant missing plantId`);
      else {
        const p = plantById.get(x.plantId);
        if (!p) err(`decor ${x.id}: unknown plantId ${x.plantId}`);
        else if (p.decorId !== x.id) err(`decor ${x.id}: plant ${p.id} does not link back`);
        else if (p.appeal !== x.appeal || p.baseCost !== x.baseCost || p.capacity !== x.capacity) err(`decor ${x.id}: plant ${p.id} values differ`);
      }
    }
    for (const e of x.effects) {
      if (e.type === 'habitatIncome' && !habitatSet.has(e.habitat)) err(`decor ${x.id}: unknown habitat ${e.habitat}`);
    }
  }

  // plants: id format, pool matches habitat's line
  for (const p of d.plants) {
    if (!p.id.startsWith(`${p.habitat}_`)) err(`plant ${p.id}: id must be <habitat>_<n>`);
    const lineId = habitatLine.get(p.habitat);
    const line = lineId === undefined ? undefined : lineById.get(lineId);
    if (line && line.decorPool !== p.pool) err(`plant ${p.id}: pool ${p.pool} != line pool ${line.decorPool}`);
    if (p.decorId && !decorById.has(p.decorId)) err(`plant ${p.id}: unknown decorId ${p.decorId}`);
  }
  for (const h of HABITATS) {
    const n = d.plants.filter((p) => p.habitat === h).length;
    if (n !== 4) err(`habitat ${h}: expected 4 plants, got ${n}`);
  }

  // cosmetics
  for (const sw of [...d.cosmetics.sand, ...d.cosmetics.paints, ...d.cosmetics.backdrops.map((b) => ({ id: b.id, hex: b.tint }))]) {
    if (!HEX.test(sw.hex)) err(`cosmetic ${sw.id}: bad hex ${sw.hex}`);
  }
  for (const h of HABITATS) {
    const bs = d.cosmetics.backdrops.filter((b) => b.habitat === h);
    if (bs.length !== 3 || bs.filter((b) => b.isDefault).length !== 1) err(`backdrops ${h}: need 1 default + 2 variants`);
  }

  return errs;
}
