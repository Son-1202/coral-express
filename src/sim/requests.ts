// Passenger Requests (SPEC B4.13). Every request on a station's board is active; it
// completes automatically when the train arrives at that station with the condition
// met. Boards are per run; completed ids are kept forever in permanent.requestHistory
// and never offered again. A board is rebuilt after `request.refreshVisits` visits.
import { earn } from './actionCheck';
import type { Ctx } from './ctx';
import { baseIncome } from './rates';
import type { RequestCondition, RequestDef, RequestReward } from './story';

const BOARD_SIZE = 3; // SPEC B4.12/B4.13: "up to 3 requests" (layout constant, not balance)

/** Car id satisfying the condition, or null. */
export function requestMetBy(ctx: Ctx, c: RequestCondition): string | null {
  const s = ctx.state;
  const m = ctx.model();
  for (const car of s.carriages) {
    const fish = car.fish.map((id) => s.fish[id]).filter((f) => !!f);
    switch (c.type) {
      case 'species': if (fish.some((f) => f.species === c.species)) return car.id; break;
      case 'shiny': if (fish.some((f) => f.shiny)) return car.id; break;
      case 'community':
        if (m.byId.get(car.id)?.bonds.active.some((b) => b.kind === 'community' && b.bondId === c.community)) return car.id;
        break;
      case 'appeal': if ((m.byId.get(car.id)?.appeal ?? 0) >= c.value - 1e-9) return car.id; break;
      case 'decor': {
        const ok = c.items.every((it) => {
          const n = car.decor.filter((d) => (it.decorId ? d.id === it.decorId : !!it.plantAny && !!ctx.idx.decor.get(d.id)?.isPlant)).length;
          return n >= it.count;
        });
        if (ok && c.items.length > 0) return car.id;
        break;
      }
      default: return null; // unknown condition type: never completes
    }
  }
  return null;
}

function grantReward(ctx: Ctx, r: RequestReward): { shells: number; ref?: string } {
  const s = ctx.state;
  switch (r.type) {
    case 'income':
    case 'incomeCosmetic': {
      const shells = baseIncome(ctx).totalSps * r.seconds;
      if (shells > 0) { earn(ctx, shells); s.lifetime.requestShells += shells; }
      if (r.type === 'incomeCosmetic' && !s.permanent.unlockedCosmetics.includes(r.cosmetic)) s.permanent.unlockedCosmetics.push(r.cosmetic);
      return { shells, ref: r.type === 'incomeCosmetic' ? r.cosmetic : undefined };
    }
    case 'shinyEgg':
      s.shinyEggs.any++;
      return { shells: 0 };
    case 'decor':
      s.decorOwned[r.decorId] = (s.decorOwned[r.decorId] ?? 0) + 1;
      return { shells: 0, ref: r.decorId };
    default:
      return { shells: 0 };
  }
}

function lineOf(sid: string): number {
  return Number(/^l(\d+)s/.exec(sid)?.[1] ?? 0);
}

/** Deterministic board: station-specific requests first, then line-wide ones (file order),
 *  skipping completed ones, ones on other boards and (if possible) the previous board's. */
function buildBoard(ctx: Ctx, sid: string, previous: string[]): string[] {
  const s = ctx.state;
  const done = new Set(s.permanent.requestHistory);
  const taken = new Set<string>();
  for (const [k, b] of Object.entries(s.requestBoards)) if (k !== sid) for (const id of b.ids) taken.add(id);
  const line = lineOf(sid);
  const all = ctx.idx.story.requests.filter((r) => r.line === line && !done.has(r.id) && !taken.has(r.id));
  const own = all.filter((r) => r.stationId === sid);
  const generic = all.filter((r) => r.stationId === undefined);
  const ordered: RequestDef[] = [...own, ...generic];
  const fresh = ordered.filter((r) => !previous.includes(r.id));
  const stale = ordered.filter((r) => previous.includes(r.id));
  return [...fresh, ...stale].slice(0, BOARD_SIZE).map((r) => r.id);
}

export function updateRequests(ctx: Ctx, sid: string, arrived: boolean): void {
  const s = ctx.state;
  const board = s.requestBoards[sid];
  if (!board) {
    s.requestBoards[sid] = { ids: buildBoard(ctx, sid, []), visits: 1 };
    return;
  }
  if (arrived) {
    for (const id of [...board.ids]) {
      const r = ctx.idx.requests.get(id);
      if (!r) continue;
      const carId = requestMetBy(ctx, r.condition);
      if (!carId) continue;
      board.ids = board.ids.filter((x) => x !== id);
      s.permanent.requestHistory.push(id);
      s.lifetime.requestsCompleted++;
      const g = grantReward(ctx, r.reward);
      ctx.emit({
        type: 'requestCompleted', requestId: id, stationId: sid, passenger: r.passenger.name, carId,
        shells: g.shells, rewardType: r.reward.type, ...(g.ref !== undefined ? { rewardRef: g.ref } : {}),
      });
    }
  }
  board.visits++;
  if (board.visits > ctx.idx.data.config.request.refreshVisits || board.ids.length === 0) {
    s.requestBoards[sid] = { ids: buildBoard(ctx, sid, board.ids), visits: 1 };
  }
}
