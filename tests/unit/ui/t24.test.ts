import { describe, expect, it } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { createSim } from '../../../src/sim';
import { lineLockText } from '../../../src/ui/helpers';

const data = loadGameData();

describe('lineLockText (T-24, T-20 two-run unlock rule)', () => {
  it('reads the run count and requirement from state + data', () => {
    const sim = createSim(data, { seed: 1 });
    const l2 = data.lines.find((l) => l.id === 2)!;
    const need = l2.opensAfterRuns ?? 1;
    const prev = data.lines.find((l) => l.id === l2.opensAfter)!;
    expect(lineLockText(data, sim.state, 2)).toContain(`Reach the ${prev.region} terminal`);
    expect(lineLockText(data, sim.state, 2)).toContain(`to open the ${l2.region} (0/${need})`);
    sim.state.permanent.terminalRuns[String(prev.id)] = 1;
    expect(lineLockText(data, sim.state, 2)).toContain(`(1/${need})`);
    sim.state.permanent.terminalRuns[String(prev.id)] = 9;
    expect(lineLockText(data, sim.state, 2)).toContain(`(${need}/${need})`);
  });
  it('says "twice" for the shipped two-run rule', () => {
    const sim = createSim(data, { seed: 1 });
    if ((data.lines.find((l) => l.id === 2)?.opensAfterRuns ?? 1) === 2) expect(lineLockText(data, sim.state, 2)).toContain('terminal twice');
  });
});
