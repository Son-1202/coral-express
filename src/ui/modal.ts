// Centered modal cards: confirm dialogs, postcards, offline popup.
import { fileUrl, hasFile } from '../assets';
import { btn, h } from './dom';
import { postcardText, station } from './content';

let layer: HTMLElement | null = null;
const stack: HTMLElement[] = [];

export function initModals(parent: HTMLElement): void {
  layer = h('div.ui-modal-layer');
  parent.appendChild(layer);
}

export function modalOpen(): boolean {
  return stack.length > 0;
}

/** Show a card; returns a close function. Clicking the backdrop closes unless `sticky`. */
export function showModal(card: HTMLElement, opts: { sticky?: boolean; onClose?: () => void } = {}): () => void {
  if (!layer) throw new Error('ui: initModals first');
  const back = h('div.ui-modal');
  back.append(card);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.classList.add('out');
    const i = stack.indexOf(back);
    if (i >= 0) stack.splice(i, 1);
    setTimeout(() => back.remove(), 220);
    opts.onClose?.();
  };
  (back as HTMLElement & { _close?: () => void })._close = close;
  if (!opts.sticky) back.addEventListener('click', (e) => e.target === back && close());
  layer.append(back);
  stack.push(back);
  return close;
}

/** Close the top-most modal (Esc). Returns true if one was closed. */
export function closeTopModal(): boolean {
  const top = stack[stack.length - 1] as (HTMLElement & { _close?: () => void }) | undefined;
  if (!top) return false;
  top._close?.();
  return true;
}

export function confirmDialog(o: { title: string; body: HTMLElement | string; ok: string; cancel?: string; danger?: boolean; onOk: () => void }): void {
  const card = h('div.ui-dialog' + (o.danger ? '.danger' : ''), { role: 'alertdialog' });
  let close = () => {};
  card.append(
    h('h2', { text: o.title }),
    typeof o.body === 'string' ? h('p', { text: o.body }) : o.body,
    h(
      'div.ui-dialog-btns',
      null,
      btn('ui-brass ghost', o.cancel ?? 'Cancel', () => close()),
      btn(`ui-brass${o.danger ? ' danger' : ''}`, o.ok, () => {
        close();
        o.onOk();
      }),
    ),
  );
  close = showModal(card);
}

/** Wren's postcard: art (if present) + handwritten text. */
export function postcardCard(stationId: string, textOverride?: string, title?: string): HTMLElement {
  const st = station(stationId);
  const art = `/ui/postcard_${stationId}.png`;
  const pic = hasFile(art)
    ? h('img.ui-pc-art', { src: fileUrl(art), alt: '' })
    : h('div.ui-pc-art.ph', { 'data-line': st?.line ?? 1 }, h('span', { text: st?.name ?? 'Coral Express' }));
  return h(
    'div.ui-postcard',
    null,
    pic,
    h(
      'div.ui-pc-back',
      null,
      h('div.ui-pc-stamp', { 'data-line': st?.line ?? 1 }),
      h('h3', { text: title ?? `Greetings from ${st?.name ?? 'the coast'}` }),
      h('p.ui-pc-text', { text: textOverride ?? postcardText(stationId) }),
    ),
  );
}

export function showPostcard(stationId: string, textOverride?: string, title?: string): void {
  const card = postcardCard(stationId, textOverride, title);
  let close = () => {};
  card.append(btn('ui-brass ui-pc-close', 'Lovely', () => close()));
  close = showModal(card);
}
