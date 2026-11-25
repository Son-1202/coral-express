// Contextual tutorial: ≤ 5 tips from src/story/tips.json. Never blocks input (one tap dismisses).
import { TIPS } from './content';
import { h } from './dom';
import { paintedImg, wrenArt } from './art';
import type { UiCtx } from './panel';

const KEY = 'coral-express.tips';

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveSeen(s: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

export class Tutorial {
  readonly root = h('div.ui-tip', { role: 'note', 'aria-live': 'polite' });
  private readonly seen = loadSeen();
  private current: string | null = null;
  private readonly offs: (() => void)[] = [];

  constructor(parent: HTMLElement, private readonly ctx: UiCtx) {
    this.root.addEventListener('click', () => this.done(this.current));
    parent.appendChild(this.root);
    const { api } = ctx;
    const s = () => api.sim.state;
    const on = api.on.bind(api);
    this.offs.push(
      on('purchase', (e) => {
        if (e.item === 'fish') this.done('buyFirstFish');
        if (e.item === 'decor') this.offer('tankViewPlant');
        if (e.item === 'fish' && (e.refId === 'carpet_anemone' || e.refId === 'clownfish')) this.offer('makeFirstPair');
      }),
      on('bondFormed', () => {
        this.done('makeFirstPair');
        this.offer('feedCarriage');
      }),
      on('frenzy', () => this.done('feedCarriage')),
      on('tankView', (e) => e.carId && this.done('tankViewPlant')),
      on('decorChanged', () => this.done('tankViewPlant')),
      on('market', () => {
        if (s().lifetime.fishBought === 0) this.offer('buyFirstFish');
        else if (s().market.requests.length && Object.keys(s().fish).length >= 2) this.offer('requestsBoard');
      }),
    );
  }

  /** Initial check (after the title screen). */
  start(): void {
    if (this.ctx.api.sim.state.lifetime.fishBought === 0) this.offer('buyFirstFish');
  }

  /** Market's Requests tab opened → that tip is done. */
  panelOpened(id: string): void {
    if (id === 'market' && this.current === 'buyFirstFish') this.root.classList.add('soft');
  }

  offer(id: string): void {
    if (this.seen.has(id) || this.current === id) return;
    const tip = TIPS.find((t) => t.id === id || t.trigger === id);
    if (!tip) return;
    if (this.current) this.seen.add(this.current);
    this.current = id;
    this.root.replaceChildren(paintedImg(wrenArt(), 'ui-tip-wren', () => h('i'), { eager: true }), h('div.ui-tip-txt', null, h('b', { text: 'Wren’s tip' }), h('span', { text: tip.text })), h('small', { text: 'tap to dismiss' }));
    this.root.classList.remove('soft');
    this.root.classList.add('show');
  }

  done(id: string | null): void {
    if (!id) return;
    this.seen.add(id);
    saveSeen(this.seen);
    if (this.current === id) {
      this.current = null;
      this.root.classList.remove('show');
    }
  }

  dispose(): void {
    this.offs.forEach((o) => o());
  }
}
