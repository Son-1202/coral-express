// Tiny DOM helpers for the UI (no framework).
import { fileUrl, hasFile, PATHS } from '../assets';
import type { GameData } from '../data/schema';

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

/** h('div.cls.other', {attr}, ...children) */
export function h<K extends keyof HTMLElementTagNameMap>(sel: K | `${K}.${string}`, attrs: Attrs | null = null, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const [tag, ...cls] = sel.split('.') as [K, ...string[]];
  const e = document.createElement(tag);
  if (cls.length) e.className = cls.join(' ');
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'html') e.innerHTML = String(v);
      else if (k === 'text') e.textContent = String(v);
      else e.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}

/** Brass button with click handler. */
export function btn(cls: string, label: Child, onClick: (ev: MouseEvent) => void, attrs: Attrs = {}): HTMLButtonElement {
  const b = h(`button.${cls}` as 'button', { type: 'button', ...attrs }, label);
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onClick(ev);
  });
  return b;
}

const HABITAT_COLORS: Record<string, [string, string]> = {
  reef: ['#f59a8b', '#47c3c9'],
  mangrove: ['#9aa35a', '#7a5a3a'],
  kelp: ['#3f7a4a', '#d9b24a'],
  polar: ['#bfe4f2', '#ffffff'],
  vent: ['#3c3a3a', '#e07a3c'],
  any: ['#86d6bd', '#fbf1d6'],
};

export function habitatColors(h: string): [string, string] {
  return HABITAT_COLORS[h] ?? HABITAT_COLORS.any;
}

/** Fish icon: sprite when present, else a habitat-tinted fish silhouette. */
export function fishIcon(data: GameData, species: string, shiny = false, size = 36): HTMLElement {
  const sp = data.species.find((s) => s.id === species);
  const wrap = h('span.ui-fish', { title: sp?.name ?? species, style: `--s:${size}px` });
  if (shiny) wrap.classList.add('shiny');
  const path = PATHS.fish(species, shiny);
  const plain = PATHS.fish(species);
  const src = hasFile(path) ? path : hasFile(plain) ? plain : null;
  if (src) {
    wrap.append(h('img', { src: fileUrl(src), alt: '', draggable: 'false' }));
  } else {
    const [a, b] = habitatColors(sp?.habitat ?? 'any');
    wrap.append(h('i.ui-fish-ph', { style: `--a:${a};--b:${b}` }));
  }
  return wrap;
}

/** Generic image with a CSS fallback block when the file is missing. */
export function artImg(path: string, cls: string, fallback: () => HTMLElement): HTMLElement {
  if (hasFile(path)) return h(`img.${cls}` as 'img', { src: fileUrl(path), alt: '', draggable: 'false' });
  return fallback();
}

/** Passenger portrait (sprite or a cosy silhouette), optional apron tint. */
export function passengerIcon(sprite: number, tint?: string, size = 56): HTMLElement {
  const wrap = h('span.ui-pass', { style: `--s:${size}px${tint ? `;--apron:${tint}` : ''}` });
  if (tint) wrap.classList.add('apron');
  const path = PATHS.passenger(sprite);
  if (hasFile(path)) wrap.append(h('img', { src: fileUrl(path), alt: '', draggable: 'false' }));
  else wrap.append(h('i.ui-pass-ph'));
  return wrap;
}

/** Decor / plant icon. */
export function decorIcon(id: string, isPlant: boolean, size = 36): HTMLElement {
  const wrap = h('span.ui-decor', { style: `--s:${size}px` });
  const path = isPlant && !hasFile(PATHS.decor(id)) ? PATHS.plant(id) : PATHS.decor(id);
  if (hasFile(path)) wrap.append(h('img', { src: fileUrl(path), alt: '', draggable: 'false' }));
  else wrap.append(h(isPlant ? 'i.ui-decor-ph.plant' : 'i.ui-decor-ph'));
  return wrap;
}

export const SHELL = '<i class="ui-shell" aria-hidden="true"></i>';
export const TICKET = '<i class="ui-ticket" aria-hidden="true"></i>';

export function clear(e: HTMLElement): void {
  e.replaceChildren();
}

export function habitatName(h: string): string {
  return h === 'any' ? 'Any' : h[0].toUpperCase() + h.slice(1);
}
