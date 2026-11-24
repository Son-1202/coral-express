// Read-only story/content lookups for the UI (src/story is CONTENT-owned; UI only reads it).
import type { GameData, LineId } from '../data/schema';
import type { RequestCondition, RequestReward } from '../sim';
import stationsJson from '../story/stations.json';
import postcardsJson from '../story/postcards.json';
import stampsJson from '../story/stamps.json';
import tipsJson from '../story/tips.json';

export interface StationInfo {
  id: string;
  line: LineId;
  index: number;
  name: string;
  stallkeeper: { name: string; tint: string; passengerSprite: number };
  greeting: string;
}
export interface Tip { id: string; trigger: string; text: string }

export const STATIONS = (stationsJson as { stations: StationInfo[] }).stations;
export const POSTCARDS = (postcardsJson as { postcards: { stationId: string; text: string }[] }).postcards;
export const NOTES = (postcardsJson as unknown as { notes: Record<string, { text: string }> }).notes ?? {};
export const SPECIES_FLAVOR = (stampsJson as { species: Record<string, string> }).species;
export const TIPS = (tipsJson as { tips: Tip[] }).tips;

export function station(id: string): StationInfo | undefined {
  return STATIONS.find((s) => s.id === id);
}
export function stationAt(line: number, index: number): StationInfo | undefined {
  return STATIONS.find((s) => s.line === line && s.index === index);
}
export function stationName(line: number, index: number): string {
  return stationAt(line, index)?.name ?? `Station ${index}`;
}
export function postcardText(stationId: string): string {
  return POSTCARDS.find((p) => p.stationId === stationId)?.text ?? '';
}

export interface DecorInfo { id: string; name: string; capacity: number; appeal: number; isPlant: boolean; effectText: string }

export function decorInfo(data: GameData, id: string): DecorInfo {
  const d = data.decor.find((x) => x.id === id);
  if (d) {
    const eff = d.effects
      .map((e) => {
        switch (e.type) {
          case 'carIncome': return `+${Math.round(e.value * 100)}% car income`;
          case 'habitatIncome': return `+${Math.round(e.value * 100)}% ${e.habitat} fish`;
          case 'frenzySeconds': return `+${e.value} s frenzy`;
          case 'bondBonusPP': return `+${Math.round(e.value * 100)} pp bonds`;
          case 'hide': return 'a cosy hideout';
          default: return '';
        }
      })
      .filter(Boolean)
      .join(' · ');
    return { id, name: d.name, capacity: d.capacity, appeal: d.appeal, isPlant: d.isPlant, effectText: eff };
  }
  const p = data.plants.find((x) => x.id === id);
  if (p) return { id, name: p.name, capacity: p.capacity, appeal: p.appeal, isPlant: true, effectText: '' };
  return { id, name: id, capacity: 1, appeal: 0, isPlant: false, effectText: '' };
}

export function speciesName(data: GameData, id: string): string {
  return data.species.find((s) => s.id === id)?.name ?? id;
}

export function conditionText(data: GameData, c: RequestCondition): string {
  switch (c.type) {
    case 'species': return `See a ${speciesName(data, c.species)}`;
    case 'community': return `See the ${data.bonds.communities.find((x) => x.id === c.community)?.name ?? 'community'} together`;
    case 'shiny': return 'See a shiny fish';
    case 'appeal': return `A carriage with ${c.value}+ appeal`;
    case 'decor':
      return c.items.map((i) => `${i.count}× ${i.plantAny ? 'plants' : decorInfo(data, i.decorId ?? '').name}`).join(' + ') + ' in one car';
    default: return 'Something special';
  }
}

export function rewardText(data: GameData, r: RequestReward): string {
  switch (r.type) {
    case 'income': return `${Math.round(r.seconds / 60)} min of income`;
    case 'incomeCosmetic': {
      const bd = data.cosmetics.backdrops.find((b) => b.id === r.cosmetic);
      return `${Math.round(r.seconds / 60)} min of income + ${bd?.name ?? 'a backdrop'}`;
    }
    case 'shinyEgg': return 'A Shiny Egg';
    case 'decor': return decorInfo(data, r.decorId).name;
    default: return 'A surprise';
  }
}
