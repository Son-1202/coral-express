/**
 * Music + ambience (Howler). Files: assets/audio/<track>.mp3 (served at /audio/<track>.mp3).
 * Nothing is fetched before `unlock()` (first user gesture). Every layer self-crossfades:
 * a track's successor starts `fade` seconds before its end (see mix.nextLoopStart), so loops
 * are seamless and playlist changes overlap instead of cutting.
 */
import { Howl } from 'howler';
import { hasFile } from '../assets';
import {
  AMB_BASE, AMB_FADE_S, DUCK_DB, MUSIC_BASE, SCENE_FADE_S,
  ambienceFor, dbToGain, nextIndex, playlistFor, sameScene,
  type AmbTrack, type AudioScene, type MusicTrack,
} from './mix';

type Track = MusicTrack | AmbTrack | 'sfx_whale_song';
const url = (t: Track) => `/audio/${t}.mp3`;

/** One playing instance of a track (a Howl sound id) with its successor timer. */
interface Voice {
  howl: Howl;
  id: number;
  timer: ReturnType<typeof setTimeout> | null;
  dead: boolean;
}

/** A bus of voices that crossfade into each other (music or ambience). */
class Channel {
  private voice: Voice | null = null;
  private list: Track[] = [];
  private idx = 0;
  constructor(
    private readonly player: MusicPlayer,
    private readonly level: () => number,
    private readonly loopFade: (t: Track) => number,
  ) {}

  /** Switch to a new playlist (empty = silence), crossfading over `fade` s. */
  set(list: Track[], fade: number): void {
    this.list = list;
    this.idx = 0;
    this.fadeOut(fade);
    if (list.length) this.start(list[0], fade);
  }

  private start(track: Track, fade: number): void {
    const howl = this.player.howl(track);
    if (!howl) return;
    const id = howl.play();
    const v: Voice = { howl, id, timer: null, dead: false };
    this.voice = v;
    howl.volume(0, id);
    howl.fade(0, this.level(), Math.max(1, fade * 1000), id);
    const schedule = () => {
      if (v.dead) return;
      const dur = howl.duration(id) || howl.duration();
      if (!(dur > 0)) return;
      const lf = Math.min(this.loopFade(track), dur / 2);
      const pos = Number(howl.seek(id)) || 0;
      v.timer = setTimeout(() => {
        if (v.dead || this.voice !== v) return;
        this.idx = nextIndex(this.list, this.idx);
        this.fadeOut(lf);
        this.start(this.list[this.idx], lf);
      }, Math.max(0, (dur - lf - pos) * 1000));
    };
    if (howl.state() === 'loaded') schedule();
    else howl.once('load', schedule);
    howl.once('end', () => kill(v), id);
  }

  private fadeOut(fade: number): void {
    const v = this.voice;
    this.voice = null;
    if (!v) return;
    if (v.timer) clearTimeout(v.timer);
    v.timer = null;
    const from = v.howl.volume(v.id) as number;
    v.howl.fade(typeof from === 'number' ? from : 0, 0, Math.max(1, fade * 1000), v.id);
    setTimeout(() => kill(v), fade * 1000 + 100);
  }

  /** Re-apply the level (volume setting / ducking) over `ms`. */
  refresh(ms: number): void {
    const v = this.voice;
    if (!v) return;
    const from = v.howl.volume(v.id);
    v.howl.fade(typeof from === 'number' ? from : 0, this.level(), Math.max(1, ms), v.id);
  }

  stop(): void {
    if (this.voice) kill(this.voice);
    this.voice = null;
  }
}

function kill(v: Voice): void {
  if (v.dead) return;
  v.dead = true;
  if (v.timer) clearTimeout(v.timer);
  v.howl.stop(v.id);
}

export class MusicPlayer {
  private howls = new Map<Track, Howl>();
  private unlocked = false;
  private scene: AudioScene | null = null;
  private applied: AudioScene | null = null;
  private musicVol = 0.7;
  private sfxVol = 0.8;
  private ducks = new Set<string>();
  private readonly music: Channel;
  private readonly amb: Channel;

  constructor() {
    const duck = () => (this.ducks.size ? dbToGain(DUCK_DB) : 1);
    this.music = new Channel(this, () => MUSIC_BASE * this.musicVol * duck(), () => SCENE_FADE_S);
    this.amb = new Channel(this, () => AMB_BASE * this.musicVol * duck(), (t) => AMB_FADE_S[t as AmbTrack] ?? 2.5);
  }

  /** Lazily create (and start loading) a Howl; null when the file does not exist. */
  howl(track: Track): Howl | null {
    if (!this.unlocked || !hasFile(url(track))) return null;
    let h = this.howls.get(track);
    if (!h) {
      h = new Howl({ src: [url(track)], preload: true, html5: false });
      h.on('loaderror', (_id, err) => console.warn(`[audio] ${track} failed to load`, err));
      this.howls.set(track, h);
    }
    return h;
  }

  /** First user gesture happened: start loading and playing the current scene. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.scene) this.apply(this.scene, 0.5);
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  setScene(scene: AudioScene): void {
    this.scene = scene;
    if (this.unlocked && !sameScene(this.applied, scene)) this.apply(scene, SCENE_FADE_S);
  }

  private apply(scene: AudioScene, fade: number): void {
    this.applied = scene;
    this.music.set(playlistFor(scene), fade);
    const amb = ambienceFor(scene);
    this.amb.set(amb ? [amb] : [], fade);
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = Math.max(0, Math.min(1, music));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    this.music.refresh(150);
    this.amb.refresh(150);
  }

  /** Duck music + ambience by DUCK_DB while any reason is active ('ending', 'whale'). */
  duck(reason: string, on: boolean): void {
    const had = this.ducks.size > 0;
    if (on) this.ducks.add(reason);
    else this.ducks.delete(reason);
    if (had !== this.ducks.size > 0) {
      this.music.refresh(800);
      this.amb.refresh(800);
    }
  }

  /** Whale song one-shot (SFX volume); ducks the music while it plays. */
  whaleSong(): void {
    const h = this.howl('sfx_whale_song');
    if (!h) return;
    const id = h.play();
    h.volume(0.9 * this.sfxVol, id);
    this.duck('whale', true);
    const release = () => this.duck('whale', false);
    h.once('end', release, id);
    h.once('playerror', release, id);
    setTimeout(release, 20000);
  }

  stopAll(): void {
    this.music.stop();
    this.amb.stop();
    this.applied = null;
  }

  dispose(): void {
    this.stopAll();
    for (const h of this.howls.values()) h.unload();
    this.howls.clear();
  }
}
