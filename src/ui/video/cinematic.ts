/**
 * Cinematic player (SPEC D9 / T-17 clips): `assets/video/<name>.{webm,mp4}` + poster `<name>.jpg`.
 * Lazy (the <video> is only created when called), muted (music is Howler's job), and falls back
 * to the matching still key art with a slow CSS Ken-Burns pan when the clip is missing, fails,
 * or quality is Low. Never throws.
 */
import { fileUrl, hasFile } from '../../assets';
import './video.css';

export interface CinematicOptions {
  loop?: boolean;
  /** Called once when a non-looping clip (or its still fallback) finishes, or on stop(). */
  onEnd?: () => void;
  /** Force the still fallback (Low quality). */
  lowQuality?: boolean;
  /** Still fallback duration for non-looping clips, seconds (default: 8). */
  stillSeconds?: number;
  /** Override the fallback still (path relative to assets/, e.g. '/ui/ending_keyart.png'). */
  still?: string;
  /** Extra class on the root element. */
  className?: string;
}

export interface CinematicHandle {
  readonly el: HTMLElement;
  /** 'video' when a clip is playing, 'still' when the fallback is shown. */
  readonly mode: 'video' | 'still';
  stop(): void;
}

/** Fallback still for a clip name (title_loop → title key art, line_<n> → Line cover, …). */
export function stillFor(name: string): string {
  if (name.startsWith('title')) return '/ui/title_keyart.png';
  if (name.startsWith('ending')) return '/ui/ending_keyart.png';
  const m = /^line_(\d)/.exec(name);
  if (m) return `/ui/line_cover_${m[1]}.png`;
  return '/ui/title_keyart.png';
}

/** Existing sources for a clip, best first (webm, then mp4). */
export function videoSources(name: string, exists: (p: string) => boolean = hasFile): { src: string; type: string }[] {
  const out: { src: string; type: string }[] = [];
  if (exists(`/video/${name}.webm`)) out.push({ src: `/video/${name}.webm`, type: 'video/webm' });
  if (exists(`/video/${name}.mp4`)) out.push({ src: `/video/${name}.mp4`, type: 'video/mp4' });
  return out;
}

export function playCinematic(container: HTMLElement, name: string, opts: CinematicOptions = {}): CinematicHandle {
  const root = document.createElement('div');
  root.className = `cine${opts.className ? ' ' + opts.className : ''}`;
  container.append(root);
  let ended = false;
  let stillTimer: ReturnType<typeof setTimeout> | null = null;
  let video: HTMLVideoElement | null = null;
  let mode: 'video' | 'still' = 'still';

  const finish = () => {
    if (ended) return;
    ended = true;
    opts.onEnd?.();
  };

  const showStill = () => {
    mode = 'still';
    if (video) {
      video.remove();
      video = null;
    }
    const path = opts.still ?? stillFor(name);
    const img = document.createElement('div');
    img.className = 'cine-still';
    if (hasFile(path)) img.style.backgroundImage = `url("${fileUrl(path, true)}")`;
    else img.classList.add('cine-still-empty');
    root.append(img);
    if (!opts.loop) stillTimer = setTimeout(finish, (opts.stillSeconds ?? 8) * 1000);
  };

  const sources = videoSources(name);
  if (opts.lowQuality || !sources.length) {
    showStill();
  } else {
    mode = 'video';
    const v = document.createElement('video');
    video = v;
    v.className = 'cine-video';
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.loop = !!opts.loop;
    const poster = `/video/${name}.jpg`;
    if (hasFile(poster)) v.poster = poster;
    for (const s of sources) {
      const el = document.createElement('source');
      el.src = s.src;
      el.type = s.type;
      v.append(el);
    }
    let failed = false;
    const fail = () => {
      if (failed || ended) return;
      failed = true;
      showStill();
    };
    v.addEventListener('error', fail);
    v.lastElementChild?.addEventListener('error', fail);
    v.addEventListener('ended', finish);
    root.append(v);
    v.play()?.catch(fail);
  }

  return {
    el: root,
    get mode() {
      return mode;
    },
    stop() {
      if (stillTimer) clearTimeout(stillTimer);
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      root.remove();
      finish();
    },
  };
}

export interface LineSplashOptions {
  /** e.g. "Line 2" */
  lineName: string;
  /** e.g. "Fog Fjords" */
  region?: string;
  lowQuality?: boolean;
  /** Seconds the splash stays up (default 5). */
  seconds?: number;
  onEnd?: () => void;
}

/** Line-opening splash: `line_<n>` clip (or the Line cover still) + Line name card. Tap to dismiss. */
export function playLineSplash(container: HTMLElement, line: number, o: LineSplashOptions): CinematicHandle {
  const wrap = document.createElement('div');
  wrap.className = 'cine-splash';
  container.append(wrap);
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    wrap.classList.add('out');
    setTimeout(() => {
      cine.stop();
      wrap.remove();
    }, 600);
    o.onEnd?.();
  };
  const cine = playCinematic(wrap, `line_${line}`, { loop: true, lowQuality: o.lowQuality });
  const card = document.createElement('div');
  card.className = 'cine-card';
  const h = document.createElement('div');
  h.className = 'cine-card-line';
  h.textContent = o.lineName;
  card.append(h);
  if (o.region) {
    const r = document.createElement('div');
    r.className = 'cine-card-region';
    r.textContent = o.region;
    card.append(r);
  }
  wrap.append(card);
  wrap.addEventListener('pointerdown', close);
  const timer = setTimeout(close, (o.seconds ?? 5) * 1000);
  return {
    el: wrap,
    get mode() {
      return cine.mode;
    },
    stop: close,
  };
}
