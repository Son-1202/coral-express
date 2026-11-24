/**
 * Grand Terminus ending sequence (SPEC B6, T-18): beach slowdown → Wren's final postcard → dive →
 * `ending_dive` clip (or Ken-Burns key art + swarms) → panorama of every owned species →
 * "The End… of the line?" → scrolling credits → onDone(). Skippable after 3 s (button / Esc).
 * DOM overlay + a 2D canvas layer; needs nothing from the T-13 scene.
 */
import endingJson from '../../story/ending.json';
import postcardsJson from '../../story/postcards.json';
import { fileUrl, hasFile } from '../../assets';
import { BeachPainter } from '../../render/ending/beach';
import { EndingLayer } from '../../render/ending/layer';
import { ownedSpecies } from '../../render/ending/owned';
import { UnderwaterPainter, type EndingFish } from '../../render/ending/underwater';
import type { GameApi } from '../types';
import { playCinematic, videoSources, type CinematicHandle } from '../video/cinematic';
import { beatAt, buildCredits, buildTimeline, creditLineCount, SKIP_AFTER_S, totalSeconds, type Beat, type BeatId, type CreditEntry } from './timeline';
import './ending.css';

export interface EndingAudioHooks {
  enterEnding(): void;
  exitEnding(): void;
}

export interface EndingOptions {
  container: HTMLElement;
  /** Game API (owned species + quality). Optional for the preview page. */
  api?: Pick<GameApi, 'sim' | 'data' | 'getSettings'>;
  /** Unused today (2D layer); accepted so callers can pass the Three renderer later. */
  renderer?: unknown;
  /** Override the panorama cast (preview / tests). */
  fish?: EndingFish[];
  lowQuality?: boolean;
  audio?: EndingAudioHooks;
  onDone: () => void;
}

export interface EndingHandle {
  skip(): void;
  /** Jump to a beat (debug / screenshots). */
  seek(beat: BeatId, u?: number): void;
  readonly beat: BeatId;
}

interface EndingLine {
  beat: string;
  text: string | null;
  postcardRef?: string;
}

const lines = endingJson.lines as EndingLine[];
const lineText = (beat: string) => lines.find((l) => l.beat === beat)?.text ?? '';

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function runEnding(o: EndingOptions): EndingHandle {
  const low = o.lowQuality ?? (o.api ? o.api.getSettings().quality === 'low' : false);
  const fish = o.fish ?? (o.api ? ownedSpecies(o.api.sim.state.fish, o.api.data.species) : []);
  const credits: CreditEntry[] = buildCredits(endingJson.credits);
  const hasVideo = !low && videoSources('ending_dive').length > 0;
  const tl: Beat[] = buildTimeline(creditLineCount(credits));
  const total = totalSeconds(tl);

  const root = el('div', 'ending');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Grand Terminus');
  o.container.append(root);
  const layer = new EndingLayer(root, low ? 0.6 : 1);
  const videoSlot = el('div', 'ending-video');
  const fade = el('div', 'ending-fade on');
  const caption = el('div', 'ending-caption');
  const postcard = buildPostcard();
  const title = el('div', 'ending-title', lineText('theEnd') || 'The End… of the line?');
  const creditsEl = buildCreditsEl(credits);
  const skipBtn = el('button', 'ending-skip', 'Skip ▸') as HTMLButtonElement;
  skipBtn.type = 'button';
  root.append(videoSlot, fade, caption, postcard, title, creditsEl, skipBtn);
  o.audio?.enterEnding();

  let start = performance.now();
  let current: BeatId | null = null;
  let cine: CinematicHandle | null = null;
  let done = false;
  let raf = 0;
  let curU = 0;
  let curPhase: 'beach' | 'dive' = 'beach';
  let beachActive = false;
  const useBeach = () => {
    if (beachActive) return;
    stopCine();
    layer.setPainter(new BeachPainter(() => ({ phase: curPhase, u: curU })));
    beachActive = true;
  };

  const say = (text: string) => {
    caption.classList.remove('on');
    if (!text) return;
    setTimeout(() => {
      caption.textContent = text;
      caption.classList.add('on');
    }, 350);
  };
  const flash = (color: string) => {
    fade.style.background = color;
    fade.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.remove('on')));
  };
  const stopCine = () => {
    cine?.stop();
    cine = null;
  };

  function enter(id: BeatId): void {
    current = id;
    root.dataset.beat = id;
    if (id === 'beach' || id === 'postcard' || id === 'dive') useBeach();
    else beachActive = false;
    postcard.classList.toggle('on', id === 'postcard');
    title.classList.toggle('on', id === 'theEnd' || id === 'credits');
    title.classList.toggle('up', id === 'credits');
    creditsEl.classList.toggle('on', id === 'credits');
    root.classList.toggle('dim', id === 'postcard' || id === 'theEnd' || id === 'credits');
    switch (id) {
      case 'beach':
        curPhase = 'beach';
        flash('#000');
        say(lineText('beachSlowdown'));
        break;
      case 'postcard':
        curPhase = 'beach';
        say('');
        break;
      case 'dive':
        curPhase = 'dive';
        say(lineText('dive'));
        break;
      case 'video':
        flash('#0a3346');
        if (hasVideo) {
          layer.setPainter(null);
          cine = playCinematic(videoSlot, 'ending_dive', { lowQuality: low, onEnd: () => undefined });
        }
        if (!hasVideo || cine?.mode === 'still') {
          stopCine();
          layer.setPainter(new UnderwaterPainter({ fish: [], backdrop: '/ui/ending_keyart.png', wildSwarms: low ? 2 : 4, seed: 3 }));
        }
        say(lineText('glassOpens'));
        break;
      case 'panorama':
        stopCine();
        flash('#0a3346');
        layer.setPainter(new UnderwaterPainter({ fish, wildSwarms: low ? 1 : 2, seed: 11 }));
        say(lineText('panorama'));
        break;
      case 'theEnd':
        say('');
        break;
      case 'credits':
        creditsEl.style.setProperty('--dur', `${tl[tl.length - 1].dur}s`);
        break;
    }
  }

  function tick(now: number): void {
    if (done) return;
    raf = requestAnimationFrame(tick);
    const t = (now - start) / 1000;
    if (t >= total) {
      finish();
      return;
    }
    const { beat, u } = beatAt(tl, t);
    curU = beat.id === 'postcard' ? 1 : u;
    if (beat.id !== current) enter(beat.id);
    if (t >= SKIP_AFTER_S) skipBtn.classList.add('on');
  }

  function finish(): void {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true);
    stopCine();
    root.classList.add('out');
    o.audio?.exitEnding();
    setTimeout(() => {
      layer.dispose();
      root.remove();
    }, 700);
    o.onDone();
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && skipBtn.classList.contains('on')) {
      e.stopPropagation();
      finish();
    }
  };
  addEventListener('keydown', onKey, true);
  skipBtn.addEventListener('click', () => finish());
  raf = requestAnimationFrame(tick);

  return {
    skip: finish,
    seek(id, u = 0) {
      const b = tl.find((x) => x.id === id);
      if (!b) return;
      start = performance.now() - (b.start + b.dur * u) * 1000;
      if (current !== id) enter(id);
    },
    get beat() {
      return current ?? 'beach';
    },
  };
}

function buildPostcard(): HTMLElement {
  const ref = lines.find((l) => l.beat === 'postcard')?.postcardRef ?? 'l3s6';
  const text = (postcardsJson.postcards as { stationId: string; text: string }[]).find((p) => p.stationId === ref)?.text ?? '';
  const card = el('div', 'ending-postcard');
  const path = `/ui/postcard_${ref}.png`;
  const art = el('div', 'ending-postcard-art');
  if (hasFile(path)) art.style.backgroundImage = `url("${fileUrl(path, true)}")`;
  const note = el('div', 'ending-postcard-text', text);
  card.append(art, note);
  return card;
}

function buildCreditsEl(credits: CreditEntry[]): HTMLElement {
  const wrap = el('div', 'ending-credits');
  const roll = el('div', 'ending-credits-roll');
  for (const c of credits) {
    const block = el('div', 'ending-credit');
    block.append(el('div', 'ending-credit-role', c.role));
    for (const n of c.names) block.append(el('div', 'ending-credit-name', n));
    roll.append(block);
  }
  wrap.append(roll);
  return wrap;
}
