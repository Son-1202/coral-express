export type NumberFormatMode = 'short' | 'scientific';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
/** From this magnitude on, numbers are always shown in scientific notation. */
const SCI_FROM = 1e18;

function trim(x: number, digits: number): string {
  // Truncate (not round) so 999,999 never shows as "1000K".
  const f = Math.pow(10, digits);
  const t = Math.floor(x * f * (1 + 1e-12)) / f;
  const s = t.toFixed(digits);
  return digits > 0 ? s.replace(/\.?0+$/, '') : s;
}

function scientific(n: number): string {
  let exp = Math.floor(Math.log10(n));
  let mant = n / Math.pow(10, exp);
  if (mant >= 9.995) {
    mant /= 10;
    exp += 1;
  }
  return `${mant.toFixed(2)}e${exp}`;
}

/**
 * The single formatter for every big number in the game.
 * short: 950, 1.2K, 3.4M, 5.6B, 7.8T, 9.1Qa, 1.2Qi; scientific from 1e18.
 * scientific: scientific from 1,000 upward.
 */
export function formatNumber(n: number, mode: NumberFormatMode = 'short'): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : '0';
  if (n < 0) return '-' + formatNumber(-n, mode);
  if (n < 1000) {
    return n < 10 && n % 1 !== 0 ? trim(n, 1) : String(Math.floor(n));
  }
  if (mode === 'scientific' || n >= SCI_FROM) return scientific(n);
  let tier = Math.floor(Math.log10(n) / 3);
  let scaled = n / Math.pow(1000, tier);
  if (scaled >= 1000) {
    tier += 1;
    scaled /= 1000;
  }
  if (tier >= SUFFIXES.length) return scientific(n);
  const digits = scaled < 100 ? 1 : 0;
  return trim(scaled, digits) + SUFFIXES[tier];
}
