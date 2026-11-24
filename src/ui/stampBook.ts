// Stamp book: species stamps (+ shiny), station stamps, Wren's postcards.
import { NOTES, SPECIES_FLAVOR, STATIONS } from './content';
import { btn, fishIcon, h } from './dom';
import { showModal, showPostcard } from './modal';
import type { PanelView, UiCtx } from './panel';

type Tab = 'species' | 'stations' | 'postcards';
let tab: Tab = 'species';

function flavorCard(title: string, text: string, icon: HTMLElement, got: boolean): void {
  let close = () => {};
  const card = h('div.ui-dialog.ui-stamp-detail', null, h('div.ui-stamp-big' + (got ? '' : '.locked'), null, icon), h('h2', { text: got ? title : '???' }), h('p', { text: got ? text : 'Not collected yet. Keep riding!' }), btn('ui-brass', 'Close', () => close()));
  close = showModal(card);
}

export function stampsPanel(ctx: UiCtx): PanelView {
  const { api } = ctx;
  return {
    id: 'stamps',
    title: () => 'Stamp Book',
    subtitle: () => {
      const p = api.sim.state.permanent;
      return `${p.stamps.length} stamps · ${p.postcards.length} postcards`;
    },
    watch: ['stamp', 'postcard'],
    render(body) {
      const p = api.sim.state.permanent;
      const has = (id: string) => p.stamps.includes(id);
      const tabs = h('div.ui-tabs');
      for (const [id, label] of [['species', 'Species'], ['stations', 'Stations'], ['postcards', "Wren's Postcards"]] as [Tab, string][]) {
        tabs.append(btn(`ui-tab${tab === id ? ' on' : ''}`, label, () => {
          tab = id;
          ctx.rerender();
        }));
      }
      body.append(tabs);
      const grid = h(`div.ui-stamps.${tab}`);
      if (tab === 'species') {
        for (const sp of api.data.species) {
          const got = has(`species:${sp.id}`);
          const shiny = has(`shiny:${sp.id}`);
          const st = btn(`ui-stamp${got ? '' : ' locked'}${shiny ? ' shiny' : ''}`, h('span.ui-stamp-in', null, fishIcon(api.data, sp.id, shiny, 44), h('small', { text: got ? sp.name : '???' })), () =>
            flavorCard(sp.name, SPECIES_FLAVOR[sp.id] ?? '', fishIcon(api.data, sp.id, shiny, 96), got),
          );
          if (shiny) st.append(h('i.ui-sparkle'));
          grid.append(st);
        }
      } else if (tab === 'stations') {
        for (const s of STATIONS) {
          const got = has(`station:${s.id}`);
          const icon = () => h('span.ui-station-ico', { 'data-line': s.line, text: String(s.index) });
          grid.append(btn(`ui-stamp round${got ? '' : ' locked'}`, h('span.ui-stamp-in', null, icon(), h('small', { text: got ? s.name : '???' })), () => flavorCard(s.name, s.greeting, icon(), got)));
        }
      } else {
        for (const s of STATIONS) {
          const got = p.postcards.includes(s.id);
          grid.append(
            btn(`ui-pc-thumb${got ? '' : ' locked'}`, h('span', null, h('i', { 'data-line': s.line }), h('small', { text: got ? s.name : 'Not yet' })), () => got && showPostcard(s.id)),
          );
        }
        if (p.resets > 0 && NOTES.firstDepotReset) grid.append(btn('ui-pc-thumb note', h('span', null, h('i', { 'data-line': 1 }), h('small', { text: 'A note from the depot' })), () => showPostcard('l1s1', NOTES.firstDepotReset.text, 'From the Depot')));
        for (const l of [2, 3]) {
          const n = NOTES[`lineOpened${l}`];
          if (n && p.openedLines.includes(l as 1 | 2 | 3)) grid.append(btn('ui-pc-thumb note', h('span', null, h('i', { 'data-line': l }), h('small', { text: `Line ${l} opens` })), () => showPostcard(`l${l}s1`, n.text, `Onward to Line ${l}`)));
        }
      }
      body.append(grid);
    },
  };
}
