// Title screen (key art, logo, Continue/New Game/Settings). The away postcard lives in offline.ts.
import { fileUrl, hasFile } from '../assets';
import { btn, h } from './dom';
import { formatDuration } from './helpers';
import { confirmDialog } from './modal';
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
      ? h('img.ui-title-art', { decoding: 'async', alt: '', src: fileUrl(art, true) })
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
