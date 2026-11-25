// Toast stack (postcards, stamps, requests, bonds, milestones) driven by sim events.
import { NOTES, speciesName, station } from './content';
import { iconArt, lineCoverArt, postcardArt, sightArt, spriteBox, toastArt } from './art';
import { fishIcon, h, passengerIcon } from './dom';
import { showPostcard } from './modal';
import type { ToastSpec, UiCtx } from './panel';

/** At most this many toasts are visible; a newer toast replaces the oldest. */
export const MAX_TOASTS = 3;

/** Phone landscape (QA bug 9): narrower than this → compact stack. Matches the CSS media query. */
export const PHONE_MAX_WIDTH = 900;

/** Stack limits for a viewport width: phones show at most 2 toasts and dismiss them sooner. */
export function toastLimits(viewportWidth: number): { max: number; msScale: number } {
  return viewportWidth < PHONE_MAX_WIDTH ? { max: 2, msScale: 0.6 } : { max: MAX_TOASTS, msScale: 1 };
}

interface PostcardGroup {
  el: HTMLElement;
  txt: HTMLElement;
  items: ToastSpec[];
  timer: ReturnType<typeof setTimeout>;
}

export class Toasts {
  readonly root = h('div.ui-toasts', { 'aria-live': 'polite' });
  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  private recent: number[] = [];
  /** Postcard toasts collapse into one card ("+2 more postcards"). */
  private cards: PostcardGroup | null = null;

  push(t: ToastSpec): void {
    // Fast-forward / offline batches emit many events at once: keep the stack calm.
    const now = performance.now();
    const lim = toastLimits(window.innerWidth);
    this.recent = this.recent.filter((x) => now - x < 1000);
    if (t.kind !== 'postcard' && this.recent.length >= lim.max) return;
    this.recent.push(now);
    if (t.kind === 'postcard' && this.cards?.el.isConnected) {
      this.cards.items.push(t);
      this.renderCards();
      return;
    }
    const el = h(`div.ui-toast.k-${t.kind}`, { role: 'status' });
    const txt = h('div.ui-toast-txt', null, h('b', { text: t.title }), t.text ? h('span', { text: t.text }) : null);
    el.append(t.icon ?? h(`i.ui-toast-ico.k-${t.kind}`), txt);
    const kill = () => {
      if (el.classList.contains('out')) return;
      el.classList.add('out');
      if (this.cards?.el === el) this.cards = null;
      setTimeout(() => el.remove(), 300);
    };
    const timer = setTimeout(kill, (t.ms ?? 4200) * lim.msScale);
    if (t.kind === 'postcard') {
      this.cards = { el, txt, items: [t], timer };
      el.classList.add('click');
      el.addEventListener('click', () => {
        const g = this.cards;
        if (!g || g.el !== el) return kill();
        const first = g.items.shift();
        first?.onClick?.();
        if (g.items.length === 0) return kill();
        this.renderCards();
      });
    } else {
      el.addEventListener('click', () => {
        t.onClick?.();
        kill();
      });
      if (t.onClick) el.classList.add('click');
    }
    this.root.prepend(el);
    // newer replace older: drop the oldest live toasts beyond the cap
    const live = [...this.root.children].filter((c) => !c.classList.contains('out'));
    for (const old of live.slice(lim.max)) {
      if (this.cards?.el === old) this.cards = null;
      old.remove();
    }
  }

  /** Repaint the grouped postcard card (first card's text + "+N more postcards") and extend its life. */
  private renderCards(): void {
    const g = this.cards;
    if (!g) return;
    const first = g.items[0];
    if (!first) return;
    const more = g.items.length - 1;
    const kids: Node[] = [h('b', { text: first.title })];
    if (first.text) kids.push(h('span', { text: first.text }));
    if (more > 0) kids.push(h('span.ui-toast-more', { text: `+${more} more postcard${more > 1 ? 's' : ''}` }));
    g.txt.replaceChildren(...kids);
    // keep the painted icon in step with the card shown (QA: grouped toasts went stale)
    const ico = g.el.firstElementChild;
    if (first.icon && ico && ico !== g.txt && ico !== first.icon) ico.replaceWith(first.icon);
    clearTimeout(g.timer);
    const el = g.el;
    g.timer = setTimeout(() => {
      el.classList.add('out');
      if (this.cards?.el === el) this.cards = null;
      setTimeout(() => el.remove(), 300);
    }, (first.ms ?? 7000) * toastLimits(window.innerWidth).msScale);
  }
}

/** Wire sim events → toasts. Returns unsubscribe. */
export function wireToasts(ctx: UiCtx, toasts: Toasts): () => void {
  const { api } = ctx;
  const data = api.data;
  const offs = [
    api.on('postcard', (e) => {
      if (e.suppressToast) return; // D-011: the ending shows the final postcard
      const st = station(e.stationId);
      toasts.push({ kind: 'postcard', title: 'A postcard from Wren', text: st ? `${st.name} — tap to read` : 'Tap to read', ms: 7000, icon: toastArt(postcardArt(e.stationId), st?.line ?? 1), onClick: () => showPostcard(e.stationId) });
    }),
    api.on('stamp', (e) => {
      if (e.kind === 'station') {
        const st = station(e.ref);
        toasts.push({ kind: 'stamp', title: 'New station stamp', text: st?.name ?? e.ref, icon: toastArt(postcardArt(e.ref), st?.line ?? 1, 'ui-toast-stamp') });
      } else {
        toasts.push({ kind: 'stamp', title: e.kind === 'shiny' ? 'Shiny stamp!' : 'New species stamp', text: speciesName(data, e.ref), icon: fishIcon(data, e.ref, e.kind === 'shiny', 34) });
      }
    }),
    api.on('requestCompleted', (e) => {
      const r = api.story.requests.find((x) => x.id === e.requestId);
      const icon = r ? passengerIcon(r.passenger.sprite, undefined, 34) : undefined;
      toasts.push({ kind: 'request', title: `${e.passenger} is delighted!`, text: e.shells > 0 ? `Request met · +${ctx.fmt(e.shells)} Shells` : 'Request met', ms: 5500, icon });
    }),
    api.on('bondFormed', (e) => {
      const name = e.kind === 'community' ? data.bonds.communities.find((c) => c.id === e.bondId)?.name ?? 'Community' : e.species.map((s) => speciesName(data, s)).join(' + ');
      const icon = h('span.ui-toast-pair', null, ...e.species.slice(0, 3).map((s) => fishIcon(data, s, false, 26)));
      toasts.push({ kind: 'bond', title: e.kind === 'community' ? 'Community formed!' : 'New bond!', text: name, icon });
    }),
    api.on('milestone', (e) => {
      toasts.push({ kind: 'milestone', title: `Level ${e.level}!`, text: `${speciesName(data, e.species)} output ×2`, icon: fishIcon(data, e.species, false, 34) });
    }),
    api.on('lineOpened', (e) => {
      const n = NOTES[`lineOpened${e.line}`];
      const l = data.lines.find((x) => x.id === e.line);
      toasts.push({ kind: 'postcard', title: `${l?.name ?? 'A new line'} is open!`, text: n ? 'Wren left a note — tap to read' : l?.region, ms: 8000, icon: toastArt(lineCoverArt(e.line), e.line), onClick: n ? () => showPostcard(`l${e.line}s1`, n.text, `Onward to ${l?.region ?? 'the next line'}`, e.line) : undefined });
    }),
    api.on('depotReset', (e) => {
      const n = NOTES.firstDepotReset;
      toasts.push({ kind: 'info', icon: spriteBox(iconArt('ticket'), 'ui-toast-sprite') ?? undefined, title: `+${ctx.fmt(e.tickets)} Tickets`, text: e.oldFriend ? 'Old Friend! +25% forever' : 'A fresh run begins', ms: 6000, onClick: n && api.sim.state.permanent.resets === 1 ? () => showPostcard('l1s1', n.text, 'From the Depot', 1) : undefined });
    }),
    api.on('sightEnd', (e) => {
      if (e.shells === 0) return;
      const s = data.sights.find((x) => x.id === e.sightId);
      toasts.push({ kind: 'sight', icon: spriteBox(sightArt(e.sightId), 'ui-toast-sprite') ?? undefined, title: s?.name ?? 'Sight', text: e.shells > 0 ? `+${ctx.fmt(e.shells)} Shells` : `−${ctx.fmt(-e.shells)} Shells` });
    }),
  ];
  return () => offs.forEach((o) => o());
}
