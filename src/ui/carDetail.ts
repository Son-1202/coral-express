// Car detail side panel: habitat, slots, fish list (level ×1/×10/Max, sell, move), bonds, decor, Tank View.
import type { Habitat } from '../data/schema';
import type { BondInfo, PossibleBond } from '../sim';
import { speciesName } from './content';
import { btn, fishIcon, h, habitatName } from './dom';
import { lineHabitats } from './helpers';
import { carLabel } from './cars';
import { iconHtml } from './hud';
import { costButton, type PanelView, type UiCtx } from './panel';

function bondName(ctx: UiCtx, kind: string, id: string, species: string[]): string {
  if (kind === 'community') return ctx.api.data.bonds.communities.find((c) => c.id === id)?.name ?? 'Community';
  return species.map((s) => speciesName(ctx.api.data, s)).join(' + ');
}

function bondRow(ctx: UiCtx, b: BondInfo | PossibleBond, active: boolean): HTMLElement {
  const data = ctx.api.data;
  const icons = h('span.ui-bond-icons');
  if (active) {
    for (const s of (b as BondInfo).species) icons.append(fishIcon(data, s, false, 26));
  } else {
    const p = b as PossibleBond;
    for (const s of p.present) icons.append(fishIcon(data, s, false, 26));
    for (const s of p.missing) icons.append(h('span.ui-missing', null, fishIcon(data, s, false, 26)));
  }
  const species = active ? (b as BondInfo).species : [...(b as PossibleBond).present, ...(b as PossibleBond).missing];
  return h(
    `div.ui-bond${active ? '.on' : ''}`,
    null,
    icons,
    h('span.ui-bond-name', { text: bondName(ctx, b.kind, b.bondId, species) }),
    active
      ? h('span.ui-bond-val', { text: `+${Math.round((b as BondInfo).bonus * 100)}%` })
      : h('span.ui-bond-need', { text: `needs ${(b as PossibleBond).missing.map((m) => speciesName(data, m)).join(', ')}` }),
  );
}

export function carPanel(ctx: UiCtx): PanelView {
  const { api } = ctx;
  const car = () => api.sim.state.carriages.find((c) => c.id === ctx.arg) ?? api.sim.state.carriages[0];
  return {
    id: 'car',
    title: () => `${carLabel(api.sim.state, car().id)} carriage`,
    subtitle: () => `${habitatName(car().habitat)} habitat${car().heritage ? " · Wren's original" : ''}`,
    watch: ['purchase', 'levelUp', 'sale', 'fishMoved', 'bondFormed', 'bondBroken', 'frenzy', 'frenzyEnd', 'decorChanged', 'specialBought', 'depotReset'],
    render(body) {
      const s = api.sim.state;
      const c = car();
      const info = api.sim.carInfo(c.id);
      body.classList.add(`hab-${c.habitat}`);
      body.append(
        h(
          'div.ui-car-hero',
          { 'data-hab': c.habitat },
          h('div.ui-stat-plate', null, h('small', { text: 'Shells/s' }), h('b', { text: ctx.fmt(info.income) })),
          h('div.ui-stat-plate', null, h('small', { text: 'Appeal' }), h('b', { text: ctx.fmt(info.appeal) })),
          h('div.ui-stat-plate', null, h('small', { text: 'Frenzy' }), h('b', { text: info.frenzyActive ? 'ON!' : info.frenzyReadyIn > 0 ? `${Math.ceil(info.frenzyReadyIn)}s` : 'Ready' })),
        ),
      );
      const actions = h('div.ui-car-actions');
      actions.append(
        btn('ui-brass', h('span', { html: `${iconHtml('feed', '<i class="ui-ico-feed"></i>')}Feed` }), () => {
          const r = api.act({ type: 'feed', carId: c.id });
          ctx.sound(r.ok ? 'click' : 'error');
        }, { disabled: info.frenzyActive || info.frenzyReadyIn > 0 }),
        btn('ui-brass seafoam', h('span', { html: `${iconHtml('tankview', '<i class="ui-ico-glass"></i>')}Open Tank View` }), () => {
          ctx.close();
          api.enterTankView(c.id);
        }),
      );
      body.append(actions);

      // habitat
      const habs = lineHabitats(api.data, s.currentLine).filter((x) => x !== c.habitat);
      if (habs.length) {
        const row = h('div.ui-hab-grid');
        for (const hb of habs) {
          const a = { type: 'changeHabitat' as const, carId: c.id, habitat: hb as Habitat };
          row.append(costButton(ctx, habitatName(hb), api.price(a), () => ctx.buy(a), { cls: `hab hab-${hb}` }));
        }
        body.append(h('h3.ui-sec', { text: 'Change habitat' }), row);
      }

      // fish
      body.append(h('h3.ui-sec', { html: `Fish <span class="ui-sec-n">${info.slotsUsed}/${info.slots} slots</span>` }));
      const list = h('div.ui-list');
      for (const fi of info.fish) {
        const f = s.fish[fi.fishId];
        if (!f) continue;
        const name = f.nickname ?? speciesName(api.data, f.species);
        const row = h('div.ui-card.ui-fishrow');
        const lvl = (n: number | 'max', label: string) => {
          const a = { type: 'levelFish' as const, fishId: f.id, times: n };
          return costButton(ctx, label, api.price(a), () => ctx.buy(a), { cls: 'sm' });
        };
        const others = s.carriages.filter((x) => x.id !== c.id && x.fish.length < x.slots);
        const move = h('select.ui-move', { 'aria-label': 'Move to carriage' }, h('option', { value: '', text: 'Move…' }), ...others.map((o) => h('option', { value: o.id, text: `→ ${carLabel(s, o.id)} (${habitatName(o.habitat)})` })));
        move.addEventListener('change', () => {
          if (move.value) ctx.sound(api.act({ type: 'moveFish', fishId: f.id, carId: move.value }).ok ? 'click' : 'error');
        });
        const refund = api.price({ type: 'sellFish', fishId: f.id });
        row.append(
          h(
            'div.ui-fish-head',
            null,
            fishIcon(api.data, f.species, f.shiny, 40),
            h(
              'div.ui-item-main',
              null,
              h('div.ui-item-name', null, name, f.mascot ? h('span.ui-cap', { title: 'Mascot' }) : null, f.shiny ? h('span.ui-chip.shiny', { text: 'shiny' }) : null),
              h(
                'div.ui-item-meta',
                null,
                h('span.ui-lv', { text: `Lv ${f.level}` }),
                h('span.ui-gain', { html: `${ctx.fmt(fi.sps)}<small>/s</small>` }),
                fi.habitatMult < 1 ? h('span.ui-warn', { text: `off-habitat ×${fi.habitatMult}` }) : null,
                fi.bondMult > 1 ? h('span.ui-chip.bond', { text: `bond ×${fi.bondMult.toFixed(2).replace(/\.?0+$/, '')}` }) : null,
              ),
            ),
          ),
          h(
            'div.ui-fish-btns',
            null,
            lvl(1, '×1'),
            lvl(10, '×10'),
            lvl('max', 'Max'),
            others.length && !f.mascot ? move : null,
            f.mascot
              ? null
              : btn('ui-sell', h('span', { html: `Sell <small>+${ctx.fmt(Math.abs(refund ?? 0))}</small>` }), () => {
                  ctx.sound(api.act({ type: 'sellFish', fishId: f.id }).ok ? 'coin' : 'error');
                }),
          ),
        );
        list.append(row);
      }
      for (let i = info.slotsUsed; i < info.slots; i++) {
        list.append(h('div.ui-card.ui-emptyslot', null, h('span', { text: 'Empty slot' }), btn('ui-link', 'Shop fish', () => ctx.open('market'))));
      }
      const slotA = { type: 'buySlot' as const, carId: c.id };
      list.append(h('div.ui-row.end', null, costButton(ctx, '+1 slot', api.price(slotA), () => ctx.buy(slotA, undefined, { carId: c.id, kind: 'slot', refId: c.id }))));
      body.append(list);

      // bonds
      body.append(h('h3.ui-sec', { text: 'Bonds' }));
      const bonds = h('div.ui-bonds');
      for (const b of info.activeBonds) bonds.append(bondRow(ctx, b, true));
      for (const b of info.possibleBonds) bonds.append(bondRow(ctx, b, false));
      if (!info.activeBonds.length && !info.possibleBonds.length) bonds.append(h('p.ui-empty', { text: 'Partners earn more together — see the fish stall for who pairs with whom.' }));
      body.append(bonds);

      // decor
      const pct = info.decorCapacity > 0 ? Math.min(100, (info.decorUsed / info.decorCapacity) * 100) : 0;
      body.append(
        h('h3.ui-sec', { html: `Decor <span class="ui-sec-n">${info.decorUsed}/${info.decorCapacity} capacity</span>` }),
        h('div.ui-meter', null, h('i', { style: `width:${pct}%` })),
        h('p.ui-hint', { text: 'Place plants and decor inside Tank View (pencil button).' }),
      );
    },
  };
}
