// Slide-in side panel host (≤ 40% width) + shared UI context.
import { formatNumber } from '../util/format';
import type { Action } from '../sim';
import { btn, h } from './dom';
import { waitLabel } from './helpers';
import type { GameApi, PanelId, UIEvents } from './types';

export interface PanelView {
  id: PanelId;
  title(): string;
  /** Small caption under the title (e.g. station name). */
  subtitle?(): string;
  /** Build the panel body (called on open and after relevant sim events). */
  render(body: HTMLElement): void;
  /** Sim event types that should trigger a re-render while open. */
  watch: string[];
}

export interface UiCtx {
  api: GameApi;
  fmt(n: number): string;
  open(id: PanelId, arg?: string): void;
  close(): void;
  rerender(): void;
  toast(t: ToastSpec): void;
  sound(id: UIEvents['uiSound']['id'], amount?: number): void;
  /** Run an action with coin chime / error shake; returns ok. */
  buy(a: Action, from?: HTMLElement, fly?: UIEvents['itemFly']): boolean;
  /** Argument of the open panel (car id for 'car'). */
  arg: string | null;
}

export interface ToastSpec {
  kind: 'postcard' | 'stamp' | 'request' | 'bond' | 'info' | 'sight' | 'milestone';
  title: string;
  text?: string;
  icon?: HTMLElement;
  ms?: number;
  onClick?: () => void;
}

/** Cost button helper: shows price, greys out + "in N s" when short. */
export function costButton(ctx: UiCtx, label: string, cost: number | null, onClick: () => void, opts: { tickets?: boolean; cls?: string } = {}): HTMLButtonElement {
  const unit = opts.tickets ? '<i class="ui-ticket"></i>' : '<i class="ui-shell"></i>';
  const b = btn(
    `ui-buy${opts.cls ? ' ' + opts.cls : ''}`,
    h('span.ui-buy-in', {
      html: `<span class="ui-buy-lbl">${label}</span>${cost === null ? '' : `<span class="ui-buy-cost">${unit}<b>${cost <= 0 ? (cost < 0 ? '+' + ctx.fmt(-cost) : 'Free') : ctx.fmt(cost)}</b></span>`}<span class="ui-wait"></span>`,
    }),
    onClick,
  );
  if (cost === null) {
    b.disabled = true;
  } else if (cost > 0) {
    b.dataset.cost = String(cost);
    if (opts.tickets) b.dataset.tickets = '1';
  }
  refreshCost(ctx, b);
  return b;
}

/** Update affordability state of one cost button. */
export function refreshCost(ctx: UiCtx, b: HTMLElement): void {
  const cost = Number(b.dataset.cost);
  if (!b.dataset.cost) return;
  const s = ctx.api.sim.state;
  const have = b.dataset.tickets ? s.permanent.tickets : s.shells;
  const poor = cost > have;
  b.classList.toggle('poor', poor);
  const w = b.querySelector('.ui-wait');
  if (w) w.textContent = poor ? (b.dataset.tickets ? 'need Tickets' : waitLabel(cost, s.shells, ctx.api.sim.stats().totalSps)) : '';
}

export class PanelHost {
  readonly root = h('aside.ui-panel', { 'aria-hidden': 'true', role: 'dialog' });
  private readonly titleEl = h('h2.ui-panel-title');
  private readonly subEl = h('div.ui-panel-sub');
  readonly body = h('div.ui-panel-body');
  current: PanelView | null = null;
  private pending = false;

  constructor(parent: HTMLElement, private readonly onClose: () => void) {
    const head = h('header.ui-panel-head', null, h('div.ui-panel-titles', null, this.titleEl, this.subEl));
    head.append(btn('ui-close', h('span', { html: '&times;', 'aria-hidden': 'true' }), () => this.onClose(), { 'aria-label': 'Close (Esc)' }));
    this.root.append(head, this.body);
    parent.appendChild(this.root);
  }

  show(v: PanelView): void {
    const same = this.current?.id === v.id;
    this.current = v;
    this.root.dataset.panel = v.id;
    this.render();
    if (!same) this.body.scrollTop = 0;
    this.root.classList.add('open');
    this.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ui-panel-open');
  }

  hide(): void {
    this.current = null;
    this.root.classList.remove('open');
    this.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ui-panel-open');
  }

  render(): void {
    const v = this.current;
    if (!v) return;
    this.titleEl.textContent = v.title();
    this.subEl.textContent = v.subtitle?.() ?? '';
    const top = this.body.scrollTop;
    this.body.replaceChildren();
    v.render(this.body);
    this.body.scrollTop = top;
  }

  /** Coalesce re-renders to one per frame. */
  schedule(): void {
    if (this.pending || !this.current) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.render();
    });
  }
}

export function defaultFmt(api: GameApi): (n: number) => string {
  return (n) => formatNumber(n, api.getSettings().numberFormat);
}
