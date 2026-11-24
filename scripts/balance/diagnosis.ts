// Diagnosis of the biggest E1 misses for the balance report. Combines the measured
// numbers with facts computed from src/data so the text stays true as CONTENT tunes.
import type { GameData } from '../../src/data/schema';
import type { MetricRow, Summary } from './metrics';

const fmt = (n: number): string => (n >= 1e6 ? n.toExponential(1).replace('e+', 'e') : n.toFixed(0));

function row(s: Summary, id: string): MetricRow | undefined {
  return s.rows.find((r) => r.id === id);
}

export function diagnosis(s: Summary, data: GameData): string[] {
  const fails = s.rows.filter((r) => r.pass === false);
  if (!fails.length) return ['All E1 targets pass.'];
  const cfg = data.config;
  const out: string[] = [];
  const sp = (id: string) => data.species.find((x) => x.id === id);
  const line = (id: number) => data.lines.find((l) => l.id === id);
  const l1 = line(1);
  const l3 = line(3);
  const cheapestL3 = Math.min(...data.species.filter((x) => x.line === 3).map((x) => x.baseCost));
  const trackL1 = l1 ? [3, 4, 5, 6].reduce((sum, k) => sum + l1.trackBase * Math.pow(l1.trackGrowth, k - 2), 0) : 0;
  const tix = (shells: number): number => Math.floor(Math.sqrt(shells / cfg.depotReset.divisor));
  const upgradeTickets = data.upgrades.reduce((sum, u) => sum + u.cost, 0);
  const g = (s.extra.greedy ?? {}) as { ticketsPerReset?: { median: number | null }; requestShare?: { p90: number | null } };

  if (row(s, 'greedyTerminus')?.pass === false || row(s, 'resetsBeforeTerminus')?.pass === false) {
    out.push(
      `- **Terminus is bimodal (too fast or never) and needs only ~2 resets.** Tickets = floor(sqrt(runShells / ${fmt(cfg.depotReset.divisor)})) ` +
        `grows with every Line's ×${line(2)?.fareMult}/×${l3?.fareMult} economy: the median greedy reset pays ~${g.ticketsPerReset?.median ?? '?'} Tickets; ` +
        `${tix(5e7)} at 5e7 run Shells and ${tix(1e12)} at 1e12, so all ${upgradeTickets} Tickets of upgrades are bought after reset 1 and ticketMult reaches ×10³–×10⁴ after reset 2. ` +
        `Run 3 then starts on Line 3 with only the Mascot, but the cheapest Line 3 species costs ${fmt(cheapestL3)} and track to l3s3 ${fmt((l3?.trackBase ?? 0) * (l3?.trackGrowth ?? 8))} ` +
        `while carried-over income is ~1e8/s: a multi-hour wall. Games that reach the Terminus (~30 min) got a Stowaway (free Line 3 fish) before all 48 slots filled; ` +
        `the rest stall with a full train of level-50 Mascot-species fish. Fix in data: a gentler ticket curve (e.g. log or a smaller exponent / larger divisor per Line), ` +
        `cheaper first Line 3 species/track, or make each Line's first species affordable from the previous Line's end income.`,
    );
  }
  if (row(s, 'fareShare')?.pass === false) {
    out.push(
      `- **Fares are ~${row(s, 'fareShare')?.value.split(' ')[0]} of income (target 25–50%).** Fish output scales with level × milestones (up to 50 × 2³ = ×400) and ticketMult, ` +
        `appeal does not scale with level at all, so fare = appeal × ${cfg.fareAppealFactor} × stationMult × fareMult falls behind within minutes. ` +
        `Needs either a much larger \`fareAppealFactor\` / \`stationMults\`, or appeal that grows with level (a rules change).`,
    );
  }
  if (row(s, 'greedyFirstReset')?.pass === false) {
    out.push(
      `- **First reset at ${row(s, 'greedyFirstReset')?.value.split(';')[0]} min (target 15–20).** Line 1 track to the terminal totals only ${fmt(trackL1)} Shells; greedy reaches l1s6 with run Shells ≫ ${fmt(cfg.depotReset.minRunShells)}, ` +
        `so the reset fires on arrival. Raising \`lines[0].trackBase\` (or minRunShells) ~1.3–1.5× moves it into range.`,
    );
  }
  if (row(s, 'firstPair')?.pass === false) {
    const cf = sp('clownfish');
    out.push(
      `- **First pair at ${row(s, 'firstPair')?.value} min (target ≤2.5).** Clownfish (${cf?.baseCost} Shells) is sold only at l1s3, so the pair needs track to station 3 (${fmt((l1?.trackBase ?? 0) * (l1?.trackGrowth ?? 8))}) ` +
        `and a full shuttle leg there; cheaper l1s3 track or a cheaper Clownfish/anemone pair at stations 1–2 fixes it.`,
    );
  }
  if (row(s, 'goalGap')?.pass === false || row(s, 'deadTime')?.pass === false) {
    out.push(
      `- **Goal gaps / dead time.** Between minutes 5–15 greedy saves for ×${l1?.trackGrowth} track steps and ×${cfg.carriageGrowth} carriages; levels at ×${cfg.levelCostGrowth}/level are the only filler, ` +
        `so typical gaps are 4–5 min and the longest no-purchase stretch is several minutes (much longer in stalled Line 3 runs). More mid-priced items per station ` +
        `(decor, slots) or a smaller \`trackGrowth\` would fill it.`,
    );
  }
  if (row(s, 'requestShare')?.pass === false) {
    out.push(
      `- **Requests share is high and very variable (p90 ${g.requestShare?.p90 !== null && g.requestShare?.p90 !== undefined ? (g.requestShare.p90 * 100).toFixed(0) + '%' : '?'}).** ` +
        `Rewards are 180–300 s of current income, repeat every run (T-06-b) and most auto-complete (species/appeal); in stalled runs they are the main income. ` +
        `Shorter reward durations (e.g. 60–120 s) would bring the median into 5–15%.`,
    );
  }
  if (row(s, 'speciesBought')?.pass === false) {
    out.push(
      `- **Species coverage.** Terminal species (watchman_goby l1s6, snow_crab l2s6) are almost never bought: the reset rule fires on arrival at the terminal. ` +
        `pocket_whale is sold only at l3s6, the Grand Terminus itself, so it can never be bought before the ending (structural). Line 3 species follow the stall above.`,
    );
  }
  if (row(s, 'dominance')?.pass === false) {
    out.push(
      `- **Dominance.** The Mascot rule (highest-level fish) picks Pebble Damsel (cheap levels reach 50 first); it is the only catalogue species at the start of the next Line, ` +
        `so later runs fill all slots with it (p90 share ~80%). Run-1 resets are near the 35% line. A Mascot rule by output, or Mascot-species stacking limits, would fix the late runs.`,
    );
  }
  if (row(s, 'offlineSooner')?.pass === false) {
    out.push('- **Offline**: not measurable while the greedy median Terminus is censored (>120 min); the 8 h break mostly helps by pushing through the Line 3 wall (higher reach %).');
  }
  if (row(s, 'bondNeverSlower')?.pass === false || row(s, 'bondNeverIncome15')?.pass === false) {
    out.push(
      `- **Bonds matter little.** Pair +${data.bonds.pairs[0]?.bonus}/community +${cfg.communityBonus} are small next to level and ticket multipliers; bond-never is close to greedy at min 15 ` +
        `and reaches the Terminus about as often (both limited by the Line 3 wall). Larger pair/community bonuses (or bonds that scale with level) would separate them.`,
    );
  }
  out.push('', `Failing: ${fails.map((r) => r.metric).join('; ')}.`);
  return out;
}
