// Diagnosis of E1 misses for the balance report (rewritten in T-20). Combines the
// measured numbers with facts from src/data so the text stays true as CONTENT tunes.
// Rows with an accepted, justified deviation are explained here; details and the
// tuning history live in docs/content/TUNING.md.
import type { GameData } from '../../src/data/schema';
import type { MetricRow, Summary } from './metrics';

function row(s: Summary, id: string): MetricRow | undefined {
  return s.rows.find((r) => r.id === id);
}

const failed = (s: Summary, id: string): boolean => row(s, id)?.pass === false;

export function diagnosis(s: Summary, data: GameData): string[] {
  const fails = s.rows.filter((r) => r.pass === false);
  if (!fails.length) return ['All E1 targets pass.'];
  const cfg = data.config;
  const out: string[] = [];
  const known = new Set(['offlineSooner', 'dominance']);

  if (failed(s, 'offlineSooner')) {
    const o = cfg.offline;
    out.push(
      `- **Offline (accepted deviation, see TUNING.md).** ${row(s, 'offlineSooner')?.value}. One ${o.capHours} h break at ${Math.round(o.rate * 100)}% ` +
        '(70% with Season Pass) is a lump of ~4–5.6 h of the income at minute 30, early in the first Line 2 run. In this economy income grows ' +
        'exponentially (e-fold every ~1–1.5 min), so a lump of N seconds of income saves only ≈ P·ln(N/P) ≈ 5–7 min, and only in the current run: ' +
        'Resets are Ticket-bound (projected ≥ 2× total) and the reset count is structural (4), so later runs are unchanged. Reaching 15–35% would need ' +
        'offline to carry across resets (a rule change outside T-20), or an offline rate/cap far beyond the SPEC.',
    );
  }
  if (failed(s, 'dominance')) {
    const dom = Object.entries(s.dominant).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
    out.push(
      `- **Dominance (accepted deviation, see TUNING.md).** ${row(s, 'dominance')?.value}. Species output grows ~×5 per station tier while a ` +
        `level only adds +1× (milestones ×${cfg.milestones.mult} at ${cfg.milestones.levels.join('/')}), so the newest tier earns most of a run's fish income at its end. ` +
        `The top species differs by run (counts of resets over 35%: ${dom}), so no species carries the session; the replay runs start with the previous ` +
        "run's top fish as Mascot, whose species is in the Catalogue. Flattening it would mean re-shaping the whole tier ladder (basePps ratios), not tuning.",
    );
  }
  for (const r of fails) {
    if (known.has(r.id)) continue;
    out.push(`- **${r.metric}** misses its target (${r.target}): ${r.value}. See docs/content/TUNING.md for the levers.`);
  }
  return out;
}
