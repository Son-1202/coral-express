// Sights (SPEC B4.8): one at a time, next start U(sightInterval) ÷ sightFrequencyMult
// seconds after the previous start (deferred while one is still active). Effects are
// timed modifiers (id `sight:<id>`); tap sights resolve on `tapSight` or on expiry.
import type { SightDef } from '../data/schema';
import { earn, fail, okCheck, type Check } from './actionCheck';
import { spawnFish } from './actionsFish';
import type { Ctx } from './ctx';
import { habitatsForLine } from './lookup';
import { baseIncome } from './rates';
import { rand } from './rng';

const EPS = 1e-9;

export function sightInterval(ctx: Ctx): number {
  const [lo, hi] = ctx.idx.data.config.sightInterval;
  return (lo + (hi - lo) * rand(ctx.state)) / ctx.fx().sightFrequencyMult;
}

function sightDef(ctx: Ctx, id: string): SightDef | undefined {
  return ctx.idx.data.sights.find((x) => x.id === id);
}

/** Start a sight now (also used by debug `triggerSight`). `now` = sim time it takes effect. */
export function startSight(ctx: Ctx, id: string, now = ctx.state.time): boolean {
  const s = ctx.state;
  const def = sightDef(ctx, id);
  if (!def || s.sight.active) return false;
  const until = def.durationSeconds === null ? null : now + def.durationSeconds;
  s.sight.active = { id, startedAt: now, until, requiresTap: def.requiresTap };
  for (const [i, e] of def.effects.entries()) {
    s.modifiers.push({ id: `sight:${id}:${i}`, kind: e.type, value: e.value, until: e.type === 'nextArrivalFareMult' ? null : until });
  }
  ctx.emit({ type: 'sightStart', sightId: id, until, requiresTap: def.requiresTap });
  return true;
}

/** End the active sight; `silent` skips the miss penalty (offline, depot reset). */
export function endSight(ctx: Ctx, tapped: boolean, silent = false, shells = 0, fishId?: string): void {
  const s = ctx.state;
  const a = s.sight.active;
  if (!a) return;
  const def = sightDef(ctx, a.id);
  s.sight.active = null;
  s.modifiers = s.modifiers.filter((m) => !m.id.startsWith(`sight:${a.id}:`));
  let delta = shells;
  if (!tapped && !silent && def?.missPenalty?.type === 'loseShellsFraction') {
    const loss = s.shells * def.missPenalty.value;
    s.shells -= loss;
    s.lifetime.sightLosses += loss;
    delta = -loss;
  }
  ctx.emit({ type: 'sightEnd', sightId: a.id, tapped, shells: delta, ...(fishId ? { fishId } : {}) });
}

/** Tick system: expire / start sights. Runs after income + train, before time advances. */
export function sightSystem(ctx: Ctx, dt: number): void {
  const s = ctx.state;
  const now = s.time + dt;
  if (s.sight.nextAt < 0) s.sight.nextAt = now + sightInterval(ctx);
  const a = s.sight.active;
  if (a) {
    const expired = a.until === null
      ? !s.modifiers.some((m) => m.id.startsWith(`sight:${a.id}:`))
      : now >= a.until - EPS;
    if (expired) endSight(ctx, false);
  }
  if (!s.sight.active && now >= s.sight.nextAt - EPS) {
    const sights = ctx.idx.data.sights;
    if (sights.length === 0) return;
    const def = sights[Math.min(sights.length - 1, Math.floor(rand(s) * sights.length))]!;
    startSight(ctx, def.id, now);
    s.sight.nextAt = now + sightInterval(ctx);
  }
}

/** Stowaway target: a species of an owned carriage habitat that was bought this run or is
 *  sold on this line's built track, placed into a free slot (home-habitat car preferred). */
function stowaway(ctx: Ctx): { species: string; carId: string } | null {
  const s = ctx.state;
  const free = s.carriages.filter((c) => c.fish.length < c.slots);
  if (free.length === 0) return null;
  const habitats = new Set(s.carriages.map((c) => c.habitat));
  const lineHabitats = habitatsForLine(ctx.idx, s.currentLine);
  const cands = ctx.idx.data.species.filter((sp) =>
    (sp.habitat === 'any' || (habitats.has(sp.habitat) && lineHabitats.includes(sp.habitat)))
    && (s.speciesBoughtThisRun.includes(sp.id) || (sp.line === s.currentLine && sp.station <= s.builtTo)));
  if (cands.length === 0) return null;
  const sp = cands[Math.min(cands.length - 1, Math.floor(rand(s) * cands.length))]!;
  const car = free.find((c) => c.habitat === sp.habitat) ?? free[0]!;
  return { species: sp.id, carId: car.id };
}

export function checkTapSight(ctx: Ctx): Check {
  const s = ctx.state;
  const a = s.sight.active;
  if (!a) return fail('noSight');
  const def = sightDef(ctx, a.id);
  if (!def || !def.requiresTap) return fail('invalid');
  const r = def.tapReward;
  if (r?.type === 'freeFish' && r.needsFreeSlot && !s.carriages.some((c) => c.fish.length < c.slots)) return fail('noSlot');
  return okCheck(0, () => {
    if (r?.type === 'fishIncomeSeconds') {
      const gain = baseIncome(ctx).fishSps * r.seconds;
      if (gain > 0) { earn(ctx, gain); s.lifetime.sightShells += gain; }
      endSight(ctx, true, false, gain);
    } else if (r?.type === 'freeFish') {
      const t = stowaway(ctx);
      const f = t ? spawnFish(ctx, t.species, t.carId) : undefined;
      if (f) ctx.refreshBonds();
      endSight(ctx, true, false, 0, f?.id);
    } else {
      endSight(ctx, true);
    }
  });
}
