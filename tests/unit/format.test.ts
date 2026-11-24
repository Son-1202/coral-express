import { describe, expect, it } from 'vitest';
import { formatNumber } from '../../src/util/format';

describe('formatNumber short', () => {
  it('keeps small numbers plain', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(2.5)).toBe('2.5');
    expect(formatNumber(950)).toBe('950');
    expect(formatNumber(999.9)).toBe('999');
  });
  it('uses K/M/B/T/Qa/Qi suffixes', () => {
    expect(formatNumber(1200)).toBe('1.2K');
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(3.4e6)).toBe('3.4M');
    expect(formatNumber(5.6e9)).toBe('5.6B');
    expect(formatNumber(7.8e12)).toBe('7.8T');
    expect(formatNumber(9.1e15)).toBe('9.1Qa');
    expect(formatNumber(123e3)).toBe('123K');
    expect(formatNumber(100e3)).toBe('100K');
    expect(formatNumber(10e6)).toBe('10M');
  });
  it('never shows 1000 of a tier', () => {
    expect(formatNumber(999_999)).toBe('999K');
    expect(formatNumber(999_999_999)).toBe('999M');
  });
  it('switches to scientific from 1e18', () => {
    expect(formatNumber(1.2e17)).toBe('120Qa');
    expect(formatNumber(1e18)).toBe('1.00e18');
    expect(formatNumber(4.56e21)).toBe('4.56e21');
  });
  it('handles negatives and non-finite values', () => {
    expect(formatNumber(-1500)).toBe('-1.5K');
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(NaN)).toBe('0');
  });
});

describe('formatNumber scientific', () => {
  it('uses scientific from 1000', () => {
    expect(formatNumber(999, 'scientific')).toBe('999');
    expect(formatNumber(1234, 'scientific')).toBe('1.23e3');
    expect(formatNumber(9.999e5, 'scientific')).toBe('1.00e6');
  });
});
