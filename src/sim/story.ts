// Typed view of the story JSON the sim needs (src/story/requests.json). Injected via
// createSim({ story }) — the sim never imports JSON. Unknown condition/reward types
// are ignored (never complete / no reward) so content can grow safely.
import type { LineId } from '../data/schema';

export type RequestCondition =
  | { type: 'species'; species: string }
  | { type: 'community'; community: string }
  | { type: 'shiny' }
  | { type: 'appeal'; value: number }
  | { type: 'decor'; items: { decorId?: string; plantAny?: boolean; count: number }[] };

export type RequestReward =
  | { type: 'income'; seconds: number }
  | { type: 'incomeCosmetic'; seconds: number; cosmetic: string }
  | { type: 'shinyEgg' }
  | { type: 'decor'; decorId: string };

export interface RequestDef {
  id: string;
  line: LineId;
  /** Station-specific request; absent = any station of the line. */
  stationId?: string;
  passenger: { name: string; sprite: number };
  text: string;
  condition: RequestCondition;
  reward: RequestReward;
}

export interface StoryData {
  requests: RequestDef[];
}

export const EMPTY_STORY: StoryData = { requests: [] };
