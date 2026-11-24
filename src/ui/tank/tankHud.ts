/** Tank View DOM overlay: top bar, fish info card, decorate dock (tray + meter + swatches), photo bar. */
import './tank.css';

export type TankMode = 'watch' | 'decorate' | 'photo';

export interface FishCardInfo {
  fishId: string;
  name: string;
  species: string;
  level: number;
  shiny: boolean;
  mascot: boolean;
  bonds: string[];
  output: string;
  flavor: string;
}

export interface TrayItem {
  id: string;
  name: string;
  count: number;
  icon: string;
  fits: boolean;
}

export interface Swatch {
  id: string;
  name: string;
  hex: string;
  locked?: boolean;
}

export interface DockModel {
  items: TrayItem[];
  used: number;
  capacity: number;
  sand: Swatch[];
  paints: Swatch[];
  backdrops: Swatch[];
  current: { sand: string; paint: string; backdrop: string };
}

export interface TankHudHandlers {
  onBack(): void;
  onMode(mode: TankMode): void;
  onNickname(fishId: string, name: string): void;
  onTrayDown(id: string, e: PointerEvent): void;
  onSwatch(kind: 'sand' | 'paint' | 'backdrop', id: string): void;
  onFrame(n: 1 | 2 | 3): void;
  onSavePhoto(): void;
  onPinPhoto(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export class TankHud {
  readonly root = el('div', 'tank-root hidden');
  private readonly title = el('div', 'tk-panel tk-title');
  private readonly modeBtns = new Map<TankMode, HTMLButtonElement>();
  private readonly card = el('div', 'tk-panel tk-card');
  private readonly hint = el('div', 'tk-panel tk-hint');
  private readonly dock = el('div', 'tk-panel tk-dock');
  private readonly photoBar = el('div', 'tk-panel tk-photo-bar');
  readonly frameCanvas = el('canvas', 'tk-photo-frame');
  private toastEl: HTMLDivElement | null = null;
  private cardFish = '';
  private dockKey = '';

  constructor(host: HTMLElement, private readonly h: TankHudHandlers) {
    const top = el('div', 'tk-top');
    const back = el('button', 'tk-btn', '← Back');
    back.setAttribute('aria-label', 'Leave tank view');
    back.addEventListener('click', () => h.onBack());
    top.append(back, this.title, el('div', 'tk-spacer'));
    const labels: [TankMode, string][] = [['watch', 'Watch'], ['decorate', '✎ Decorate (E)'], ['photo', 'Photo (P)']];
    for (const [m, label] of labels) {
      const b = el('button', 'tk-btn', label);
      b.addEventListener('click', () => h.onMode(m));
      this.modeBtns.set(m, b);
      top.append(b);
    }
    this.card.style.display = 'none';
    this.dock.style.display = 'none';
    this.photoBar.style.display = 'none';
    this.frameCanvas.style.display = 'none';
    for (const [n, label] of [[1, 'Ticket'], [2, 'Postcard'], [3, 'Polaroid']] as const) {
      const b = el('button', 'tk-btn', label);
      b.dataset.frame = String(n);
      b.addEventListener('click', () => h.onFrame(n));
      this.photoBar.append(b);
    }
    const save = el('button', 'tk-btn', 'Save PNG');
    save.addEventListener('click', () => h.onSavePhoto());
    const pin = el('button', 'tk-btn', 'Pin postcard');
    pin.addEventListener('click', () => h.onPinPhoto());
    const done = el('button', 'tk-btn', 'Done');
    done.addEventListener('click', () => h.onMode('watch'));
    this.photoBar.append(save, pin, done);
    this.root.append(this.frameCanvas, top, this.card, this.hint, this.dock, this.photoBar);
    host.appendChild(this.root);
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }

  setTitle(text: string, heritage: boolean): void {
    this.title.textContent = text;
    if (heritage) this.title.append(el('span', 'tk-heritage', "Heritage · Wren's original"));
  }

  setMode(mode: TankMode): void {
    for (const [m, b] of this.modeBtns) b.classList.toggle('on', m === mode);
    this.root.classList.toggle('photo', mode === 'photo');
    this.dock.style.display = mode === 'decorate' ? '' : 'none';
    this.photoBar.style.display = mode === 'photo' ? '' : 'none';
    this.frameCanvas.style.display = mode === 'photo' ? '' : 'none';
    this.hint.textContent =
      mode === 'decorate'
        ? 'Drag from the tray · drag to move · scroll/pinch to scale · tap to flip · hold to remove'
        : 'Tap a fish to follow it · tap the water to drop food · Esc to leave';
    if (mode !== 'watch') this.showCard(null);
  }

  setPhotoFrame(n: number): void {
    for (const b of this.photoBar.querySelectorAll<HTMLButtonElement>('[data-frame]')) b.classList.toggle('on', b.dataset.frame === String(n));
  }

  showCard(info: FishCardInfo | null): void {
    if (!info) {
      this.card.style.display = 'none';
      this.cardFish = '';
      return;
    }
    this.card.style.display = '';
    const input = this.card.querySelector('input');
    const editing = input && document.activeElement === input;
    if (this.cardFish === info.fishId && editing) return;
    this.cardFish = info.fishId;
    this.card.replaceChildren();
    const name = el('input');
    name.value = info.name;
    name.maxLength = 18;
    name.setAttribute('aria-label', 'Nickname');
    name.addEventListener('change', () => this.h.onNickname(info.fishId, name.value.trim()));
    name.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') name.blur();
    });
    const row = (k: string, v: string, cls = '') => {
      const r = el('div', 'tk-row');
      r.append(el('span', '', k), el('span', cls, v));
      return r;
    };
    this.card.append(name, row('Species', info.species), row('Level', String(info.level), 'tk-num'), row('Output', info.output, 'tk-num'));
    if (info.shiny) this.card.append(row('', '★ Shiny', 'tk-shiny'));
    if (info.mascot) this.card.append(row('', 'Mascot · conductor', 'tk-shiny'));
    this.card.append(row('Bonds', info.bonds.length ? info.bonds.join(', ') : '—'));
    if (info.flavor) this.card.append(el('div', 'tk-flavor', info.flavor));
  }

  /** Update the live numbers on the open card without rebuilding it. */
  refreshCard(info: FishCardInfo): void {
    if (this.cardFish !== info.fishId) return this.showCard(info);
    const nums = this.card.querySelectorAll('.tk-num');
    if (nums[0]) nums[0].textContent = String(info.level);
    if (nums[1]) nums[1].textContent = info.output;
  }

  setDock(m: DockModel): void {
    const key = JSON.stringify(m);
    if (key === this.dockKey) return;
    this.dockKey = key;
    this.dock.replaceChildren();
    const tray = el('div', 'tk-tray');
    if (!m.items.length) tray.append(el('div', 'tk-empty', 'No decor in your tray — buy some at a station market.'));
    for (const it of m.items) {
      const b = el('div', `tk-item${it.fits ? '' : ' nofit'}`);
      b.title = `${it.name}${it.fits ? '' : ' (no room)'}`;
      const img = el('img');
      img.src = it.icon;
      img.alt = it.name;
      b.append(img, el('span', 'tk-count', `×${it.count}`));
      b.addEventListener('pointerdown', (e) => this.h.onTrayDown(it.id, e));
      tray.append(b);
    }
    const bar = el('div', 'tk-bar');
    const meter = el('div', 'tk-meter');
    const mb = el('div', 'tk-meter-bar');
    const fill = el('div', `tk-meter-fill${m.used >= m.capacity ? ' full' : ''}`);
    fill.style.width = `${Math.min(100, (m.used / Math.max(1, m.capacity)) * 100)}%`;
    mb.append(fill);
    meter.append(el('span', '', 'Capacity'), mb, el('span', 'tk-num', `${m.used}/${m.capacity}`));
    bar.append(meter);
    const group = (label: string, kind: 'sand' | 'paint' | 'backdrop', list: Swatch[], cur: string) => {
      const g = el('div', 'tk-sw-group');
      g.append(el('span', '', label));
      for (const s of list) {
        const b = el('button', `tk-sw${s.id === cur ? ' on' : ''}${s.locked ? ' locked' : ''}`);
        b.style.background = s.hex;
        b.title = s.locked ? `${s.name} (locked)` : s.name;
        b.setAttribute('aria-label', `${label} ${s.name}`);
        b.addEventListener('click', () => !s.locked && this.h.onSwatch(kind, s.id));
        g.append(b);
      }
      return g;
    };
    bar.append(group('Sand', 'sand', m.sand, m.current.sand), group('Backdrop', 'backdrop', m.backdrops, m.current.backdrop), group('Paint', 'paint', m.paints, m.current.paint));
    this.dock.append(tray, bar);
  }

  toast(text: string): void {
    this.toastEl?.remove();
    const t = el('div', 'tk-panel tk-toast', text);
    this.root.append(t);
    this.toastEl = t;
    setTimeout(() => t.remove(), 2200);
  }

  dispose(): void {
    this.root.remove();
  }
}
