import { describe, expect, it } from 'vitest';
import {
  ambienceFor, clackInterval, coinSemitones, dbToGain, equalPower, loopSchedule, nextIndex,
  nextLoopStart, playlistFor, sameScene, semitoneRatio,
} from '../../../src/audio/mix';

describe('playlist order', () => {
  it('alternates the Line variant and the main theme', () => {
    const list = playlistFor({ kind: 'line', line: 2 });
    expect(list).toEqual(['music_l2', 'music_main']);
    let i = 0;
    const seq = [list[i]];
    for (let k = 0; k < 4; k++) seq.push(list[(i = nextIndex(list, i))]);
    expect(seq).toEqual(['music_l2', 'music_main', 'music_l2', 'music_main', 'music_l2']);
  });
  it('depot and ending are single loops without ambience', () => {
    expect(playlistFor({ kind: 'depot' })).toEqual(['music_depot']);
    expect(playlistFor({ kind: 'ending' })).toEqual(['music_ending']);
    expect(ambienceFor({ kind: 'depot' })).toBeNull();
    expect(ambienceFor({ kind: 'line', line: 1 })).toBe('amb_l1');
    expect(nextIndex(['a'], 0)).toBe(0);
  });
  it('compares scenes', () => {
    expect(sameScene({ kind: 'line', line: 1 }, { kind: 'line', line: 1 })).toBe(true);
    expect(sameScene({ kind: 'line', line: 1 }, { kind: 'line', line: 2 })).toBe(false);
    expect(sameScene(null, { kind: 'depot' })).toBe(false);
    expect(sameScene({ kind: 'depot' }, { kind: 'depot' })).toBe(true);
  });
});

describe('crossfade scheduler', () => {
  it('starts the successor `fade` s before the end', () => {
    expect(nextLoopStart(10, 45, 3.5)).toBeCloseTo(51.5);
    expect(loopSchedule(0, 45, 3, 3)).toEqual([0, 42, 84]);
  });
  it('clamps the fade to half the clip', () => {
    expect(nextLoopStart(0, 4, 10)).toBe(2);
    expect(nextLoopStart(0, 4, -1)).toBe(4);
  });
  it('equal-power gains keep constant power', () => {
    for (const u of [0, 0.25, 0.5, 0.9, 1]) {
      const g = equalPower(u);
      expect(g.out ** 2 + g.in ** 2).toBeCloseTo(1);
    }
    expect(equalPower(-1)).toEqual({ out: 1, in: 0 });
  });
  it('ducks by ~-9 dB', () => {
    expect(dbToGain(-9)).toBeCloseTo(0.3548, 3);
  });
});

describe('pitch mapping', () => {
  it('rises with log10(amount) and caps at two octaves', () => {
    expect(coinSemitones(0)).toBe(0);
    expect(coinSemitones(1)).toBe(0);
    expect(coinSemitones(10)).toBeCloseTo(2);
    expect(coinSemitones(1e6)).toBeCloseTo(12);
    expect(coinSemitones(1e30)).toBe(24);
    expect(coinSemitones(NaN)).toBe(0);
    expect(coinSemitones(1000)).toBeGreaterThan(coinSemitones(100));
    expect(semitoneRatio(12)).toBeCloseTo(2);
  });
  it('wheel clack gets faster with speed and stops when stopped', () => {
    expect(clackInterval(0)).toBeNull();
    expect(clackInterval(1)!).toBeGreaterThan(clackInterval(3)!);
    expect(clackInterval(1000)).toBe(0.09);
  });
});
