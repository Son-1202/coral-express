/** View-models for the Tank View overlay (info card, decorate dock) built from sim state + data. */
import stamps from '../../story/stamps.json';
import { formatNumber } from '../../util/format';
import type { DockModel, FishCardInfo, TrayItem } from '../../ui/tank/tankHud';
import type { TankApi } from './types';
import { decorUrls, firstExisting, plantUrls } from './assets';
import { paintDecor, paintPlant } from './paint';
import type { Habitat } from '../../data/schema';

const NICK_KEY = 'coral.tank.nicknames';

export function readNicknames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NICK_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveNickname(fishId: string, name: string): void {
  const all = readNicknames();
  if (name) all[fishId] = name;
  else delete all[fishId];
  try {
    localStorage.setItem(NICK_KEY, JSON.stringify(all));
  } catch {
    /* storage full / blocked: nickname stays for this session only */
  }
}

const flavor = (stamps as { species?: Record<string, string> }).species ?? {};

export function buildCard(api: TankApi, carId: string, fishId: string): FishCardInfo | null {
  const st = api.state();
  const f = st.fish[fishId];
  if (!f) return null;
  const def = api.data.species.find((s) => s.id === f.species);
  const name = (n: string) => api.data.species.find((s) => s.id === n)?.name ?? n;
  let bonds: string[] = [];
  let output = '—';
  try {
    const info = api.carInfo(carId);
    bonds = info.activeBonds
      .filter((b) => b.fishIds.includes(fishId))
      .map((b) => (b.kind === 'community' ? api.data.bonds.communities.find((c) => c.id === b.bondId)?.name ?? b.bondId : b.species.map(name).join(' + ')));
    const fi = info.fish.find((x) => x.fishId === fishId);
    if (fi) output = `${formatNumber(fi.sps)} /s`;
  } catch {
    /* car gone mid-frame */
  }
  return {
    fishId,
    name: f.nickname ?? readNicknames()[fishId] ?? def?.name ?? f.species,
    species: def?.name ?? f.species,
    level: f.level,
    shiny: f.shiny,
    mascot: !!f.mascot,
    bonds,
    output,
    flavor: flavor[f.species] ?? '',
  };
}

const iconCache = new Map<string, string>();
function iconFor(api: TankApi, id: string): string {
  const hit = iconCache.get(id);
  if (hit) return hit;
  const d = api.data.decor.find((x) => x.id === id);
  const plant = api.data.plants.find((p) => p.id === (d?.plantId ?? id));
  const url = firstExisting(plant ? plantUrls(plant.id) : decorUrls(id));
  const icon = url ?? (plant ? paintPlant(plant.habitat as Habitat, Number(plant.id.split('_')[1] ?? 1)) : paintDecor(id)).toDataURL();
  iconCache.set(id, icon);
  return icon;
}

export function decorCapacityOf(api: TankApi, id: string): number {
  return api.data.decor.find((x) => x.id === id)?.capacity ?? api.data.plants.find((p) => p.id === id)?.capacity ?? 1;
}

export function buildDock(api: TankApi, carId: string): DockModel | null {
  const st = api.state();
  const car = st.carriages.find((c) => c.id === carId);
  if (!car) return null;
  let used = 0;
  let capacity = 0;
  try {
    const info = api.carInfo(carId);
    used = info.decorUsed;
    capacity = info.decorCapacity;
  } catch {
    /* ignore */
  }
  const placed: Record<string, number> = {};
  for (const c of st.carriages) for (const d of c.decor) placed[d.id] = (placed[d.id] ?? 0) + 1;
  const items: TrayItem[] = [];
  for (const [id, owned] of Object.entries(st.decorOwned)) {
    const count = owned - (placed[id] ?? 0);
    if (count <= 0) continue;
    const name = api.data.decor.find((x) => x.id === id)?.name ?? api.data.plants.find((p) => p.id === id)?.name ?? id;
    items.push({ id, name, count, icon: iconFor(api, id), fits: used + decorCapacityOf(api, id) <= capacity });
  }
  const c = api.data.cosmetics;
  const unlocked = new Set(st.permanent.unlockedCosmetics);
  return {
    items,
    used,
    capacity,
    sand: c.sand.map((s) => ({ ...s })),
    paints: c.paints.map((s) => ({ ...s })),
    backdrops: c.backdrops
      .filter((b) => b.habitat === car.habitat)
      .map((b) => ({ id: b.id, name: b.name, hex: b.tint, locked: !b.isDefault && b.unlockable && !unlocked.has(b.id) })),
    current: { ...car.cosmetics },
  };
}
