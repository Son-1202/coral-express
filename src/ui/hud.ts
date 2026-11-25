import { fileUrl } from '../assets';
import { formatNumber, type NumberFormatMode } from '../util/format';
import { iconArt } from './art';
import './hud.css';

export interface HudState {
  shells: number;
  shellsPerSec: number;
  tickets: number;
  progress: number;
  eta: number;
  stationLabel: string;
}

const BUTTONS = [
  { id: 'market', label: 'Market', key: 'M', icon: svg('<path d="M3 12c3-5 9-6 13-2l4-3v10l-4-3c-4 4-10 3-13-2z"/><circle cx="8" cy="11" r="1.2" fill="#fff6e0"/>') },
  { id: 'track', label: 'Track', key: 'T', icon: svg('<path d="M8 2 5 22M16 2l3 20" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 6h14M5 11h14M4 16h16M4 21h16" stroke="currentColor" stroke-width="2"/>') },
  { id: 'stamps', label: 'Stamps', key: 'S', icon: svg('<path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/><circle cx="12" cy="12" r="4"/>') },
  { id: 'depot', label: 'Depot', key: 'D', icon: svg('<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6" fill="#fff6e0"/>') },
] as const;

/** Painted pixel icon `icons/<name>.png` as an <img> tag, else the procedural fallback markup (T-26). */
export function iconHtml(name: string, fallback: string, exists?: (p: string) => boolean): string {
  const p = exists ? iconArt(name, exists) : iconArt(name);
  return p ? `<img class="ui-ico hud-img" src="${fileUrl(p)}" alt="" draggable="false">` : fallback;
}

function svg(inner: string): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">${inner}</svg>`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** DOM HUD skeleton: top ticket bar (currencies + next-station progress) and bottom brass-plate buttons. */
export class Hud {
  readonly root = el('div', 'hud');
  private readonly shells: HTMLElement;
  private readonly sps: HTMLElement;
  private readonly tickets: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly eta: HTMLElement;
  private readonly station: HTMLElement;

  constructor(parent: HTMLElement, onButton: (id: string) => void) {
    const top = el('div', 'hud-top');
    const stat = (cls: string, icon: string, label: string) => {
      const s = el('div', `hud-stat ${cls}`, `<span class="hud-ico">${icon}</span><span class="hud-col"><span class="hud-lbl">${label}</span><span class="hud-num">0</span></span>`);
      top.appendChild(s);
      return s.querySelector('.hud-num') as HTMLElement;
    };
    this.shells = stat('shells', iconHtml('shell', '<i class="shell"></i>'), 'Shells');
    this.sps = stat('sps', '<i class="wave"></i>', 'Shells/s');
    this.tickets = stat('tickets', iconHtml('ticket', '<i class="ticket"></i>'), 'Tickets');
    const prog = el(
      'div',
      'hud-progress',
      `<div class="hud-prog-head"><span class="hud-station"></span><span class="hud-eta hud-num"></span></div>
       <div class="hud-bar"><div class="hud-fill"></div><div class="hud-train"></div></div>`,
    );
    top.appendChild(prog);
    this.fill = prog.querySelector('.hud-fill') as HTMLElement;
    this.eta = prog.querySelector('.hud-eta') as HTMLElement;
    this.station = prog.querySelector('.hud-station') as HTMLElement;

    const bottom = el('nav', 'hud-bottom');
    for (const b of BUTTONS) {
      const btn = el('button', 'hud-btn', `<span class="hud-btn-ico" aria-hidden="true">${iconHtml(`tab_${b.id}`, b.icon)}</span><span>${b.label}</span><kbd>${b.key}</kbd>`);
      btn.type = 'button';
      btn.dataset.id = b.id;
      btn.setAttribute('aria-label', b.label);
      btn.addEventListener('click', () => onButton(b.id));
      bottom.appendChild(btn);
    }
    this.root.append(top, bottom);
    parent.appendChild(this.root);
  }

  update(s: HudState, mode: NumberFormatMode = 'short'): void {
    this.shells.textContent = formatNumber(s.shells, mode);
    this.sps.textContent = formatNumber(s.shellsPerSec, mode);
    this.tickets.textContent = formatNumber(s.tickets, mode);
    const pct = `${(s.progress * 100).toFixed(1)}%`;
    this.fill.style.width = pct;
    (this.fill.nextElementSibling as HTMLElement).style.left = pct;
    this.eta.textContent = `${Math.ceil(s.eta)}s`;
    this.station.textContent = s.stationLabel;
  }
}

/** Portrait-phone overlay with a looping CSS mini train. */
export function mountRotateCard(parent: HTMLElement): void {
  const card = el(
    'div',
    'rotate-card',
    `<div class="rotate-inner">
       <div class="rotate-phone"></div>
       <h2>Please rotate your phone</h2>
       <p>The Coral Express runs along a wide coast — turn sideways to ride along.</p>
       <div class="mini-track"><div class="mini-train"><i class="loco"></i><i class="car"></i><i class="car"></i><i class="car"></i></div></div>
     </div>`,
  );
  parent.appendChild(card);
}
