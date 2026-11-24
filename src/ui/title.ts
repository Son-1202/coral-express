// Title screen (key art, logo, Continue/New Game/Settings) + "While you were away" postcard.
import { fileUrl, hasFile } from '../assets';
import type { OfflineResult } from '../sim';
import { btn, h, SHELL } from './dom';
import { formatDuration } from './helpers';
import { confirmDialog, showModal } from './modal';
import type { UiCtx } from './panel';

export interface TitleOpts {
  hasSave: boolean;
  away: number | null;
  onContinue: () => void;
  onSettings: () => void;
}

export function showTitle(parent: HTMLElement, ctx: UiCtx, o: TitleOpts): () => void {
  const art = '/ui/title_keyart.png';
  const root = h('div.ui-title');
  root.append(
    hasFile(art)
      ? h('img.ui-title-art', { src: fileUrl(art), alt: '' })
      : h('div.ui-title-art.ph', null, h('i.sun'), h('i.hills'), h('i.sea'), h('i.rail'), h('div.ui-title-train', null, h('i.loco'), h('i.car'), h('i.car'), h('i.car'))),
  );
  const close = () => {
    root.classList.add('out');
    setTimeout(() => root.remove(), 450);
  };
  const go = () => {
    close();
    o.onContinue();
  };
  const menu = h('div.ui-title-menu');
  if (o.hasSave) {
    menu.append(btn('ui-brass big', h('span.ui-title-btn', null, h('b', { text: 'Continue' }), o.away && o.away > 60 ? h('small', { text: `away ${formatDuration(o.away)}` }) : null), go));
  }
  menu.append(
    btn(`ui-brass${o.hasSave ? '' : ' big'}`, h('span.ui-title-btn', null, h('b', { text: 'New Game' })), () => {
      if (!o.hasSave) return go();
      confirmDialog({
        title: 'Start a new trip?',
        body: 'Your current save — Tickets, stamps and postcards — will be erased.',
        ok: 'Start over',
        danger: true,
        onOk: () => {
          if (ctx.api.newGame) ctx.api.newGame();
          else go();
        },
      });
    }),
    btn('ui-brass ghost', h('span.ui-title-btn', null, h('b', { text: 'Settings' })), () => o.onSettings()),
  );
  root.append(
    h(
      'div.ui-title-card',
      null,
      h('div.ui-logo', null, h('span.ui-logo-top', { text: 'All aboard the' }), h('h1', { text: 'Coral Express' }), h('span.ui-logo-sub', { text: 'a seaside aquarium railway' })),
      menu,
    ),
  );
  parent.appendChild(root);
  return close;
}

/** "While you were away" postcard. */
export function showOffline(ctx: UiCtx, r: OfflineResult): void {
  let close = () => {};
  const card = h(
    'div.ui-postcard.ui-offline',
    null,
    h('div.ui-pc-art.ph.away', { 'data-line': ctx.api.sim.state.currentLine }, h('span', { text: 'While you were away' })),
    h(
      'div.ui-pc-back',
      null,
      h('div.ui-pc-stamp', { 'data-line': ctx.api.sim.state.currentLine }),
      h('h3', { text: 'The train kept rolling…' }),
      h(
        'dl.ui-away',
        null,
        h('dt', { text: 'Time away' }),
        h('dd', { text: formatDuration(r.seconds) }),
        h('dt', { text: 'Shells earned' }),
        h('dd', { html: `${SHELL}${ctx.fmt(r.shells)}` }),
        h('dt', { text: 'Stations visited' }),
        h('dd', { text: ctx.fmt(r.stationsVisited) }),
      ),
    ),
    btn('ui-brass ui-pc-close', 'Collect', () => {
      ctx.sound('coin', r.shells);
      close();
    }),
  );
  close = showModal(card);
}
