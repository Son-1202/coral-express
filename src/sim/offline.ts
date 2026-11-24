// Offline catch-up (SPEC B4.10): rate × (fish Shells/s + average fare rate) × capped time,
// computed at the current state without frenzy / Sight buffs, which simply expire.
import { earn } from './actionCheck';
import type { Ctx } from './ctx';
import { arrivalSeconds, baseIncome } from './rates';
import { endSight, sightInterval } from './sights';
import type { OfflineResult } from './types';

export function offlineParams(ctx: Ctx): { capSeconds: number; rate: number } {
  const o = ctx.fx().offline ?? ctx.idx.data.config.offline;
  return { capSeconds: o.capHours * 3600, rate: o.rate };
}

export function advanceOffline(ctx: Ctx, seconds: number): OfflineResult {
  if (!Number.isFinite(seconds) || seconds <= 0) return { seconds: 0, shells: 0, stationsVisited: 0 };
  const s = ctx.state;
  const { capSeconds, rate } = offlineParams(ctx);
  const t = Math.min(seconds, capSeconds);
  const shells = rate * baseIncome(ctx).totalSps * t;
  const stationsVisited = Math.floor(t / arrivalSeconds(ctx));
  if (shells > 0) earn(ctx, shells);
  s.lifetime.offlineShells += shells;
  s.lifetime.offlineSeconds += t;
  // Timed effects expire; the train keeps its position (phase is cosmetic here).
  endSight(ctx, false, true);
  s.time += t;
  s.modifiers = s.modifiers.filter((m) => m.until === null || m.until > s.time);
  s.sight.nextAt = s.time + sightInterval(ctx);
  const r: OfflineResult = { seconds: t, shells, stationsVisited };
  ctx.emit({ type: 'offline', ...r });
  return r;
}
