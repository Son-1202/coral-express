/**
 * Grand Terminus ending: beat timeline + credits list (pure, unit-tested).
 * Text comes from src/story/ending.json (CONTENT); durations are presentation timing.
 */
export type BeatId = 'beach' | 'postcard' | 'dive' | 'video' | 'panorama' | 'theEnd' | 'credits';

export interface Beat {
  id: BeatId;
  start: number;
  dur: number;
}

/** Beat durations in seconds (45 s + 8–14 s of credits). */
export const BEAT_SECONDS: Record<Exclude<BeatId, 'credits'>, number> = {
  beach: 6,
  postcard: 9,
  dive: 7,
  video: 10,
  panorama: 9,
  theEnd: 4,
};

/** Skip becomes available after this many seconds. */
export const SKIP_AFTER_S = 3;

/** Credits scroll seconds: 3 s base + 0.8 s per line, clamped to 8..14 (whole ending ≤ 60 s). */
export function creditsSeconds(lines: number): number {
  return Math.max(8, Math.min(14, 3 + lines * 0.8));
}

export function buildTimeline(creditLines: number, videoSeconds = BEAT_SECONDS.video): Beat[] {
  const order: Exclude<BeatId, 'credits'>[] = ['beach', 'postcard', 'dive', 'video', 'panorama', 'theEnd'];
  const out: Beat[] = [];
  let t = 0;
  for (const id of order) {
    const dur = id === 'video' ? videoSeconds : BEAT_SECONDS[id];
    out.push({ id, start: t, dur });
    t += dur;
  }
  out.push({ id: 'credits', start: t, dur: creditsSeconds(creditLines) });
  return out;
}

export const totalSeconds = (tl: readonly Beat[]): number => {
  const last = tl[tl.length - 1];
  return last ? last.start + last.dur : 0;
};

/** Beat at time t (clamped to the last one) and progress u ∈ [0,1] inside it. */
export function beatAt(tl: readonly Beat[], t: number): { beat: Beat; index: number; u: number } {
  let i = 0;
  while (i < tl.length - 1 && t >= tl[i + 1].start) i++;
  const b = tl[i];
  const u = b.dur > 0 ? Math.max(0, Math.min(1, (t - b.start) / b.dur)) : 1;
  return { beat: b, index: i, u };
}

export interface CreditEntry {
  role: string;
  names: string[];
}

/** Tool credits required by the ticket (art + music providers). */
export const TOOL_CREDITS: CreditEntry[] = [
  { role: 'Art', names: ['Higgsfield (Nano Banana Pro, GPT Image)'] },
  { role: 'Music', names: ['ElevenLabs via Higgsfield'] },
];

/** ending.json credits + tool credits (deduped by role, story credits first). */
export function buildCredits(story: readonly CreditEntry[]): CreditEntry[] {
  const out = story.map((c) => ({ role: c.role, names: [...c.names] }));
  for (const c of TOOL_CREDITS) {
    const hit = out.find((o) => o.role === c.role);
    if (hit) {
      for (const n of c.names) if (!hit.names.includes(n)) hit.names.push(n);
    } else {
      out.push({ role: c.role, names: [...c.names] });
    }
  }
  return out;
}

export const creditLineCount = (c: readonly CreditEntry[]): number => c.reduce((n, e) => n + 1 + e.names.length, 0);
