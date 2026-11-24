import { describe, expect, it } from 'vitest';
import endingJson from '../../../src/story/ending.json';
import { beatAt, buildCredits, buildTimeline, creditLineCount, totalSeconds } from '../../../src/ui/ending/timeline';
import { ownedSpecies } from '../../../src/render/ending/owned';
import { railAt, frontAt } from '../../../src/render/ending/beach';
import { stillFor, videoSources } from '../../../src/ui/video/cinematic';
import { loadGameData } from '../../../src/data/schema';

describe('ending timeline', () => {
  const credits = buildCredits(endingJson.credits);
  const tl = buildTimeline(creditLineCount(credits));
  it('runs 45–60 s, beats in order and contiguous', () => {
    expect(tl.map((b) => b.id)).toEqual(['beach', 'postcard', 'dive', 'video', 'panorama', 'theEnd', 'credits']);
    for (let i = 1; i < tl.length; i++) expect(tl[i].start).toBeCloseTo(tl[i - 1].start + tl[i - 1].dur);
    expect(totalSeconds(tl)).toBeGreaterThanOrEqual(45);
    expect(totalSeconds(tl)).toBeLessThanOrEqual(62);
  });
  it('beatAt finds the beat and progress', () => {
    expect(beatAt(tl, 0).beat.id).toBe('beach');
    const mid = beatAt(tl, tl[2].start + tl[2].dur / 2);
    expect(mid.beat.id).toBe('dive');
    expect(mid.u).toBeCloseTo(0.5);
    expect(beatAt(tl, 999).beat.id).toBe('credits');
    expect(beatAt(tl, 999).u).toBe(1);
  });
  it('credits include story credits and the tool credits', () => {
    const roles = credits.map((c) => c.role);
    expect(roles).toContain('Game by');
    expect(credits.find((c) => c.role === 'Art')?.names[0]).toMatch(/Higgsfield/);
    expect(credits.find((c) => c.role === 'Music')?.names[0]).toMatch(/ElevenLabs/);
    const again = buildCredits(credits);
    expect(creditLineCount(again)).toBe(creditLineCount(credits));
  });
});

describe('ending helpers', () => {
  it('owned species: unique, data order, shiny if any copy is shiny', () => {
    const data = loadGameData();
    const [a, b] = data.species;
    const fish = {
      f1: { species: b.id, shiny: false },
      f2: { species: a.id, shiny: false },
      f3: { species: b.id, shiny: true },
    };
    const out = ownedSpecies(fish, data.species);
    expect(out.map((f) => f.species)).toEqual([a.id, b.id]);
    expect(out[1].shiny).toBe(true);
    expect(out[0].motion).toBe(a.motion);
  });
  it('rails run flat then downhill; the train decelerates then dives', () => {
    expect(railAt(0.5).y).toBe(railAt(1).y);
    expect(railAt(3.5).y).toBeGreaterThan(railAt(2.5).y);
    expect(frontAt('beach', 1)).toBeCloseTo(frontAt('dive', 0));
    expect(frontAt('beach', 0.9) - frontAt('beach', 0.8)).toBeLessThan(frontAt('beach', 0.2) - frontAt('beach', 0.1));
  });
  it('video fallbacks', () => {
    expect(stillFor('line_2')).toBe('/ui/line_cover_2.png');
    expect(stillFor('ending_dive')).toBe('/ui/ending_keyart.png');
    expect(stillFor('title_loop')).toBe('/ui/title_keyart.png');
    const only = new Set(['/video/x.mp4']);
    expect(videoSources('x', (p) => only.has(p))).toEqual([{ src: '/video/x.mp4', type: 'video/mp4' }]);
  });
});
