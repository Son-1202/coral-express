// E1 metrics from raw game records: medians / p10 / p90 + target checks.
import type { GameRecord, Variant } from './game';

export interface Dist { n: number; p10: number | null; median: number | null; p90: number | null; max?: number | null }

export interface MetricRow {
  id: string;
  metric: string;
  target: string;
  /** Human-readable value. */
  value: string;
  pass: boolean | null;
  /** How PASS is decided. */
  rule: string;
  raw?: unknown;
}

/** Quantile with +Infinity for censored values (not reached); null if empty. */
export function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))));
  return a[i]!;
}

export function dist(xs: number[]): Dist {
  return { n: xs.length, p10: quantile(xs, 0.1), median: quantile(xs, 0.5), p90: quantile(xs, 0.9), max: xs.length ? Math.max(...xs) : null };
}

const fin = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : v);
const mins = (s: number | null): string => (s === null ? 'n/a' : Number.isFinite(s) ? (s / 60).toFixed(1) : '>limit');
const pct = (v: number | null): string => (v === null || !Number.isFinite(v) ? 'n/a' : `${(v * 100).toFixed(1)}%`);
const distMin = (d: Dist): string => `${mins(d.median)} (p10 ${mins(d.p10)}, p90 ${mins(d.p90)})`;
const distPct = (d: Dist): string => `${pct(d.median)} (p10 ${pct(d.p10)}, p90 ${pct(d.p90)})`;
const inRange = (v: number | null, lo: number, hi: number): boolean => v !== null && Number.isFinite(v) && v >= lo && v <= hi;

/** Times with not-reached = +Infinity (so medians are honest about censoring). */
function times(rs: GameRecord[], f: (r: GameRecord) => number | null): number[] {
  return rs.map((r) => f(r) ?? Infinity);
}
const share = (rs: GameRecord[], f: (r: GameRecord) => boolean): number => (rs.length ? rs.filter(f).length / rs.length : 0);

export interface Summary {
  games: Record<string, number>;
  rows: MetricRow[];
  species: Record<string, number>;
  dominant: Record<string, number>;
  illegal: Record<string, number>;
  extra: Record<string, unknown>;
}

export function summarize(by: Partial<Record<Variant, GameRecord[]>>, speciesIds: string[], minutes: number): Summary {
  const rows: MetricRow[] = [];
  const g = by.greedy ?? [];
  const r = by.random ?? [];
  const b = by.bondNever ?? [];
  const o = by.greedyOffline ?? [];
  const skip = (id: string, metric: string, target: string): void => { rows.push({ id, metric, target, value: 'not run', pass: null, rule: '' }); };

  const gTerm = dist(times(g, (x) => x.terminus));
  if (g.length) {
    const d = dist(times(g, (x) => x.firstReset));
    rows.push({ id: 'greedyFirstReset', metric: 'Greedy time to first Depot Reset', target: '15–20 min', value: `${distMin(d)}; not within ${minutes} min: ${pct(share(g, (x) => x.firstReset === null))}`, pass: inRange(d.median, 900, 1200), rule: 'median in range', raw: d });
  } else skip('greedyFirstReset', 'Greedy time to first Depot Reset', '15–20 min');
  if (r.length) {
    const d = dist(times(r, (x) => x.firstReset));
    const never = share(r, (x) => x.firstReset === null);
    rows.push({ id: 'randomFirstReset', metric: 'Random time to first Depot Reset', target: `35–70 min (or not within ${minutes} min in ≤20% runs)`, value: `${distMin(d)}; not within ${minutes} min: ${pct(never)}`, pass: inRange(d.median, 2100, 4200) || (never <= 0.2 && (d.median ?? 0) >= 2100), rule: 'median in range, or median ≥ 35 min with ≤20% never', raw: { ...d, never } });
  } else skip('randomFirstReset', 'Random time to first Depot Reset', '35–70 min');
  if (g.length) {
    rows.push({ id: 'greedyTerminus', metric: 'Greedy time to Grand Terminus (active)', target: '60–90 min', value: `${distMin(gTerm)}; reached: ${pct(share(g, (x) => x.terminus !== null))}`, pass: inRange(gTerm.median, 3600, 5400), rule: 'median in range', raw: gTerm });
  } else skip('greedyTerminus', 'Greedy time to Grand Terminus (active)', '60–90 min');
  if (o.length && g.length) {
    const d = dist(times(o, (x) => x.terminus));
    const sooner = fin(d.median) !== null && fin(gTerm.median) !== null ? 1 - d.median! / gTerm.median! : null;
    rows.push({ id: 'offlineSooner', metric: 'Greedy + one 8 h offline break at min 30: Terminus sooner', target: '15–35% sooner', value: `${pct(sooner)} (offline median ${mins(d.median)} vs ${mins(gTerm.median)}; reached ${pct(share(o, (x) => x.terminus !== null))})`, pass: sooner !== null && sooner >= 0.15 && sooner <= 0.35, rule: '1 − median(offline)/median(greedy) in range', raw: { offline: d, sooner } });
  } else skip('offlineSooner', 'Greedy + 8 h offline: Terminus sooner', '15–35% sooner');
  if (b.length && g.length) {
    const d = dist(times(b, (x) => x.terminus));
    const notReached = share(b, (x) => x.terminus === null);
    const slower = fin(d.median) !== null && fin(gTerm.median) !== null ? d.median! / gTerm.median! - 1 : null;
    rows.push({ id: 'bondNeverSlower', metric: 'Bond-never time to Terminus vs greedy', target: `≥30% slower (or not reached in ${minutes} min)`, value: `${slower === null ? 'n/a' : pct(slower) + ' slower'}; median ${mins(d.median)}; not reached ${pct(notReached)}`, pass: (slower !== null && slower >= 0.3) || (d.median === Infinity && gTerm.median !== Infinity), rule: 'median ratio ≥ 1.3, or bond-never median not reached while greedy is', raw: { bondNever: d, slower, notReached } });
    const gi = quantile(g.map((x) => x.income15), 0.5) ?? 0;
    const bi = quantile(b.map((x) => x.income15), 0.5) ?? 0;
    const ratio = gi > 0 ? bi / gi : null;
    rows.push({ id: 'bondNeverIncome15', metric: 'Bond-never avg income at min 15 of run 1 vs greedy', target: '≤75%', value: `${pct(ratio)} (bond-never ${bi.toExponential(2)}/s vs greedy ${gi.toExponential(2)}/s)`, pass: ratio !== null && ratio <= 0.75, rule: 'ratio of medians', raw: { greedy: gi, bondNever: bi, ratio } });
  } else { skip('bondNeverSlower', 'Bond-never time to Terminus vs greedy', '≥30% slower'); skip('bondNeverIncome15', 'Bond-never income at min 15 vs greedy', '≤75%'); }
  if (g.length) {
    const d = dist(times(g, (x) => x.firstPair));
    rows.push({ id: 'firstPair', metric: 'First game time to first pair (greedy)', target: '≤2.5 min', value: distMin(d), pass: d.median !== null && d.median <= 150, rule: 'median', raw: d });
    const req = dist(g.map((x) => (x.earned > 0 ? x.request / x.earned : 0)));
    rows.push({ id: 'requestShare', metric: 'Share of greedy income from Requests', target: '5–15%', value: distPct(req), pass: inRange(req.median, 0.05, 0.15), rule: 'median in range', raw: req });
    const gaps = dist(g.map((x) => (x.goalGaps.length ? Math.max(...x.goalGaps) : 0)));
    rows.push({ id: 'goalGap', metric: 'Max gap between meaningful goals, min 5–15 of each run (greedy)', target: 'never > 3 min', value: `${distMin(gaps)}; games with a gap > 3 min: ${pct(share(g, (x) => x.goalGaps.some((v) => v > 180)))}`, pass: gaps.p90 !== null && gaps.p90 <= 180, rule: 'p90 of per-game max ≤ 3 min', raw: gaps });
    const fare = dist(g.map((x) => (x.earned > 0 ? x.fare / x.earned : 0)));
    rows.push({ id: 'fareShare', metric: 'Fares vs total (greedy, session avg)', target: 'fares 25–50% of total', value: distPct(fare), pass: inRange(fare.median, 0.25, 0.5), rule: 'median in range', raw: fare });
    const dom = g.flatMap((x) => x.resets.map((y) => y.topShare));
    const dd = dist(dom);
    rows.push({ id: 'dominance', metric: 'Max single-species share of fish income at each reset (greedy)', target: '≤35%', value: `${distPct(dd)}; resets over 35%: ${pct(dom.length ? dom.filter((v) => v > 0.35).length / dom.length : null)}`, pass: dd.p90 !== null && dd.p90 <= 0.35, rule: 'p90 over all resets ≤ 35%', raw: dd });
    const sp: Record<string, number> = {};
    for (const id of speciesIds) sp[id] = share(g, (x) => x.species.includes(id));
    const low = Object.entries(sp).filter(([, v]) => v < 0.9);
    rows.push({ id: 'speciesBought', metric: 'Every species bought before Terminus (greedy)', target: '≥90% of runs per species', value: low.length ? `${low.length}/${speciesIds.length} species below 90%: ${low.map(([k, v]) => `${k} ${pct(v)}`).join(', ')}` : 'all ≥ 90%', pass: low.length === 0, rule: 'every species ≥ 90% of games', raw: sp });
    const dead = dist(g.map((x) => x.deadTime));
    rows.push({ id: 'deadTime', metric: 'Longest dead time after min 1 (greedy)', target: '≤90 s', value: `${(dead.median ?? 0).toFixed(0)} s (p10 ${(dead.p10 ?? 0).toFixed(0)}, p90 ${(dead.p90 ?? 0).toFixed(0)}, max ${(dead.max ?? 0).toFixed(0)})`, pass: dead.p90 !== null && dead.p90 <= 90, rule: 'p90 of per-game longest gap between purchases ≤ 90 s', raw: dead });
    const reached = g.filter((x) => x.terminus !== null);
    const rc = dist(reached.map((x) => x.resets.length));
    rows.push({ id: 'resetsBeforeTerminus', metric: 'Depot Resets before Terminus (greedy)', target: '3–6', value: reached.length ? `${rc.median} (p10 ${rc.p10}, p90 ${rc.p90}); over ${reached.length} games that reached it` : `Terminus never reached (resets in ${minutes} min: median ${quantile(g.map((x) => x.resets.length), 0.5)})`, pass: reached.length > 0 && inRange(rc.median, 3, 6), rule: 'median over games reaching the Terminus', raw: rc });
  }
  const dominant: Record<string, number> = {};
  for (const x of g) for (const y of x.resets) if (y.topShare > 0.35) dominant[y.topSpecies] = (dominant[y.topSpecies] ?? 0) + 1;
  const species: Record<string, number> = {};
  for (const id of speciesIds) species[id] = share(g, (x) => x.species.includes(id));
  const games: Record<string, number> = {};
  const illegal: Record<string, number> = {};
  for (const [k, v] of Object.entries(by)) { games[k] = v?.length ?? 0; illegal[k] = (v ?? []).reduce((s, x) => s + x.illegal, 0); }
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(by)) {
    if (!v?.length) continue;
    const lines = v.flatMap((x) => x.resets.map((y) => y.tickets));
    extra[k] = {
      firstReset: dist(times(v, (x) => x.firstReset)),
      terminus: dist(times(v, (x) => x.terminus)),
      resets: dist(v.map((x) => x.resets.length)),
      ticketsPerReset: dist(lines),
      fareShare: dist(v.map((x) => (x.earned > 0 ? x.fare / x.earned : 0))),
      requestShare: dist(v.map((x) => (x.earned > 0 ? x.request / x.earned : 0))),
      offlineShare: dist(v.map((x) => (x.earned > 0 ? x.offline / x.earned : 0))),
      deadTime: dist(v.map((x) => x.deadTime)),
      income15: dist(v.map((x) => x.income15)),
    };
  }
  return { games, rows, species, dominant, illegal, extra };
}
