// Diagnosis paragraph for the balance report (filled in after reading the numbers).
import type { Summary } from './metrics';

export function diagnosis(s: Summary): string[] {
  const fails = s.rows.filter((r) => r.pass === false).map((r) => r.metric);
  return fails.length ? [`Failing: ${fails.join('; ')}.`] : ['All E1 targets pass.'];
}
