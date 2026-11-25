// Market side panel: stallkeeper header + Fish / Decor / Special / Requests / Catalogue tabs.
import type { Habitat } from '../data/schema';
import type { CarInfo } from '../sim';
import { conditionText, decorInfo, rewardText, speciesName, station } from './content';
import { decorIcon } from './art';
import { btn, fishIcon, h, habitatName, passengerIcon } from './dom';
import { defaultTargetCar, fishGainWithBonds, lineHabitats, partnersOf } from './helpers';
import { costButton, type PanelView, type UiCtx } from './panel';
import { carLabel, carPicker } from './cars';

type Tab = 'fish' | 'decor' | 'special' | 'requests' | 'catalogue';
const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'fish', label: 'Fish', short: 'Fish' },
  { id: 'decor', label: 'Decor & plants', short: 'Decor' },
  { id: 'special', label: "Today's Special", short: 'Special' },
  { id: 'requests', label: 'Requests', short: 'Requests' },
  { id: 'catalogue', label: 'Catalogue', short: 'All' },
];

let tab: Tab = 'fish';
/** 'auto' = best car per item. */
let target: string = 'auto';

export function openMarketTab(t: string): void {
  if (TABS.some((x) => x.id === t)) tab = t as Tab;
}

export function marketPanel(ctx: UiCtx): PanelView {
  const { api } = ctx;
  return {
    id: 'market',
    title: () => station(api.sim.state.market.stationId)?.name ?? 'Station Market',
    subtitle: () => `Line ${api.sim.state.currentLine} · Station ${api.sim.state.market.station} market`,
    watch: ['purchase', 'market', 'levelUp', 'sale', 'specialBought', 'requestCompleted', 'fishMoved', 'trackBuilt', 'decorChanged'],
    render(body) {
      body.append(keeperCard(ctx));
      const tabs = h('div.ui-tabs', { role: 'tablist' });
      for (const t of TABS) {
        const b = btn(`ui-tab${t.id === tab ? ' on' : ''}`, h('span', { html: `<span class="full">${t.label}</span><span class="short">${t.short}</span>` }), () => {
          tab = t.id;
          ctx.rerender();
        }, { role: 'tab', 'aria-selected': t.id === tab ? 'true' : 'false' });
        if (t.id === 'requests' && api.sim.state.market.requests.length) b.append(h('span.ui-badge', { text: api.sim.state.market.requests.length }));
        tabs.append(b);
      }
      body.append(tabs);
      const list = h('div.ui-list');
      ({ fish: fishTab, decor: decorTab, special: specialTab, requests: requestsTab, catalogue: catalogueTab })[tab](ctx, list);
      body.append(list);
    },
  };
}

function keeperCard(ctx: UiCtx): HTMLElement {
  const st = station(ctx.api.sim.state.market.stationId);
  if (!st) return h('div');
  return h(
    'div.ui-keeper',
    null,
    passengerIcon(st.stallkeeper.passengerSprite, st.stallkeeper.tint, 58),
    h('div.ui-keeper-txt', null, h('b', { text: st.stallkeeper.name }), h('q', { text: st.greeting })),
  );
}

function targetRow(ctx: UiCtx): HTMLElement {
  return h('div.ui-target', null, h('span.ui-target-lbl', { text: 'Deliver to' }), carPicker(ctx, target, true, (id) => {
    target = id;
    ctx.rerender();
  }));
}

function speciesCard(ctx: UiCtx, species: string, signature: boolean): HTMLElement {
  const { api } = ctx;
  const s = api.sim.state;
  const sp = api.data.species.find((x) => x.id === species);
  if (!sp) return h('div');
  const carId = target === 'auto' ? defaultTargetCar(s, api.data, species) : target;
  const car = s.carriages.find((c) => c.id === carId);
  const cost = carId ? api.price({ type: 'buyFish', species, carId }) : null;
  const est = fishGainWithBonds(api.data, s, sp, car ?? null, car ? safeCarInfo(ctx, car.id) : null);
  const partners = partnersOf(api.data, species);
  const card = h('div.ui-card.ui-item');
  if (signature && !s.speciesBoughtThisRun.includes(species)) card.append(h('span.ui-ribbon', { text: 'NEW' }));
  const off = car && sp.habitat !== 'any' && !sp.flags.alwaysHome && sp.habitat !== car.habitat;
  card.append(
    fishIcon(api.data, species, false, 48),
    h(
      'div.ui-item-main',
      null,
      h('div.ui-item-name', { text: sp.name }),
      h(
        'div.ui-item-meta',
        null,
        h(`span.ui-chip.hab-${sp.habitat}`, { text: habitatName(sp.habitat) }),
        h('span.ui-gain', { html: `+${ctx.fmt(est.sps)}<small>/s</small>` }),
        est.bond ? h('span.ui-chip.bond', { text: '+bond', title: `Completes a bond: ${est.bond}` }) : null,
        off ? h('span.ui-warn', { text: 'off-habitat', title: 'Earns less outside its home habitat' }) : null,
      ),
      partners.length
        ? h('div.ui-partners', null, h('span', { text: 'Pairs with' }), ...partners.slice(0, 4).map((p) => fishIcon(api.data, p, false, 22)))
        : null,
    ),
  );
  const side = h('div.ui-item-side');
  if (!carId) side.append(h('span.ui-note', { text: 'No free slot' }));
  else {
    side.append(h('span.ui-to', { text: `→ ${carLabel(s, carId)}` }));
    side.append(costButton(ctx, 'Buy', cost, (/* */) => {
      ctx.buy({ type: 'buyFish', species, carId }, card, { carId, kind: 'fish', refId: species });
    }));
  }
  card.append(side);
  return card;
}

function fishTab(ctx: UiCtx, list: HTMLElement): void {
  const m = ctx.api.sim.state.market;
  list.append(targetRow(ctx));
  if (!m.fish.length) list.append(h('p.ui-empty', { text: 'The fish stall opens at the next station.' }));
  m.fish.forEach((id, i) => list.append(speciesCard(ctx, id, i === 0)));
}

function decorCard(ctx: UiCtx, id: string): HTMLElement {
  const { api } = ctx;
  const d = decorInfo(api.data, id);
  const owned = api.sim.state.decorOwned[id] ?? 0;
  const cost = api.price({ type: 'buyDecor', decorId: id });
  const card = h('div.ui-card.ui-item');
  card.append(
    decorIcon(api.data, id, 48),
    h(
      'div.ui-item-main',
      null,
      h('div.ui-item-name', { text: d.name }),
      h(
        'div.ui-item-meta',
        null,
        h('span.ui-chip', { text: `${d.capacity} cap` }),
        h('span.ui-chip.appeal', { text: `+${d.appeal} appeal` }),
        owned ? h('span.ui-chip.owned', { text: `owned ${owned}` }) : null,
      ),
      d.effectText ? h('div.ui-item-desc', { text: d.effectText }) : null,
    ),
    h('div.ui-item-side', null, costButton(ctx, owned ? 'Restock' : 'Buy', cost, () => {
      ctx.buy({ type: 'buyDecor', decorId: id }, card, { carId: api.selectedCar() ?? api.sim.state.carriages[0].id, kind: 'decor', refId: id });
    })),
  );
  return card;
}

function decorTab(ctx: UiCtx, list: HTMLElement): void {
  const m = ctx.api.sim.state.market;
  list.append(h('p.ui-hint', { text: 'Bought decor goes to your tray — place it in Tank View.' }));
  if (!m.decor.length) list.append(h('p.ui-empty', { text: 'Nothing on the stall today.' }));
  for (const id of m.decor) list.append(decorCard(ctx, id));
}

let specialTarget = '';

function specialTab(ctx: UiCtx, list: HTMLElement): void {
  const { api } = ctx;
  const s = api.sim.state;
  const sp = s.market.special;
  if (!sp) {
    list.append(h('p.ui-empty', { text: 'No special today. Check back at the next station!' }));
    return;
  }
  const c = api.data.config.todaysSpecial;
  let title = '';
  let desc = '';
  let picker: HTMLElement | null = null;
  let tgt: string | undefined;
  /** Sprite inside the special's medallion (fish specials), else the CSS medallion alone. */
  let art: HTMLElement[] = [];
  switch (sp.kind) {
    case 'levelDiscount':
      title = `${speciesName(api.data, sp.species ?? '')} lessons`;
      desc = `−${Math.round(c.levelDiscount * 100)}% on its next ${c.levelDiscountCount} level-ups.`;
      if (sp.species) art = [fishIcon(api.data, sp.species, false, 46), h('b.ui-special-off', { text: `−${Math.round(c.levelDiscount * 100)}%` })];
      break;
    case 'shinyEgg': {
      title = 'Shiny Egg';
      desc = 'The next one you buy of the chosen species hatches shiny.';
      const opts = [...new Set([s.market.fish[0], ...s.speciesBoughtThisRun].filter(Boolean))];
      if (!opts.includes(specialTarget)) specialTarget = opts[0] ?? '';
      tgt = specialTarget;
      picker = h('div.ui-chooser');
      for (const id of opts) {
        const b = btn(`ui-choice${id === specialTarget ? ' on' : ''}`, fishIcon(api.data, id, true, 28), () => {
          specialTarget = id;
          ctx.rerender();
        }, { title: speciesName(api.data, id) });
        picker.append(b);
      }
      if (specialTarget) art = [fishIcon(api.data, specialTarget, true, 46)];
      break;
    }
    case 'freeSlot': {
      title = 'Free fish slot';
      desc = 'One extra slot for a carriage of your choice.';
      const cars = s.carriages.filter((x) => x.slots < api.data.config.maxSlots);
      if (!cars.some((x) => x.id === specialTarget)) specialTarget = cars[0]?.id ?? '';
      tgt = specialTarget;
      picker = carPicker(ctx, specialTarget, false, (id) => {
        specialTarget = id;
        ctx.rerender();
      });
      break;
    }
    case 'cosmetic': {
      const bd = api.data.cosmetics.backdrops.find((b) => b.id === sp.cosmetic);
      title = bd?.name ?? 'Backdrop';
      desc = `A new ${bd ? habitatName(bd.habitat).toLowerCase() : ''} backdrop for your tanks.`;
      break;
    }
  }
  const card = h('div.ui-card.ui-special' + (sp.sold ? '.sold' : ''));
  card.append(
    h('div.ui-special-tag', { text: "Today's Special" }),
    h('div.ui-special-icon', { 'data-kind': sp.kind }, ...art),
    h('div.ui-item-name', { text: title }),
    h('p.ui-item-desc', { text: desc }),
  );
  if (picker) card.append(picker);
  if (sp.sold) card.append(h('div.ui-stamp-sold', { text: 'Sold out' }));
  else {
    const a = { type: 'buySpecial' as const, ...(tgt ? { target: tgt } : {}) };
    card.append(costButton(ctx, 'Buy special', api.price(a), () => {
      ctx.buy(a, card, { carId: sp.kind === 'freeSlot' && tgt ? tgt : s.carriages[0].id, kind: 'special', refId: sp.kind });
    }, { cls: 'wide' }));
  }
  list.append(card);
}

function requestsTab(ctx: UiCtx, list: HTMLElement): void {
  const { api } = ctx;
  const s = api.sim.state;
  const ids = s.market.requests;
  list.append(h('p.ui-hint', { text: 'Meet a wish, then come back — passengers check on your next visit here.' }));
  if (!ids.length) list.append(h('p.ui-empty', { text: 'The board is empty today.' }));
  for (const id of ids) {
    const r = api.story.requests.find((x) => x.id === id);
    if (!r) continue;
    const done = s.requestsDoneThisRun.includes(id);
    list.append(
      h(
        'div.ui-card.ui-request' + (done ? '.done' : ''),
        null,
        passengerIcon(r.passenger.sprite, undefined, 48),
        h(
          'div.ui-item-main',
          null,
          h('div.ui-item-name', { text: r.passenger.name }),
          h('q.ui-req-text', { text: r.text }),
          h('div.ui-req-cond', { html: `<b>Wish</b> ${conditionText(api.data, r.condition)}` }),
          h('div.ui-req-rew', null, h('b', { text: 'Reward' }), ' ', r.reward.type === 'decor' ? decorIcon(api.data, r.reward.decorId, 22) : null, rewardText(api.data, r.reward)),
        ),
        done ? h('span.ui-stamp-done', { text: 'Done' }) : null,
      ),
    );
  }
}

function catalogueTab(ctx: UiCtx, list: HTMLElement): void {
  const { api } = ctx;
  const s = api.sim.state;
  list.append(targetRow(ctx));
  list.append(h('h3.ui-sec', { text: 'Fish aboard this run' }));
  if (!s.speciesBoughtThisRun.length) list.append(h('p.ui-empty', { text: 'Buy a fish at a stall and it shows up here.' }));
  for (const id of s.speciesBoughtThisRun) list.append(speciesCard(ctx, id, false));
  const owned = Object.keys(s.decorOwned).filter((k) => (s.decorOwned[k] ?? 0) > 0);
  if (owned.length) {
    list.append(h('h3.ui-sec', { text: 'Decor (restock)' }));
    for (const id of owned) list.append(decorCard(ctx, id));
  }
  list.append(h('h3.ui-sec', { text: 'Carriages' }));
  const habs = lineHabitats(api.data, s.currentLine);
  const row = h('div.ui-card.ui-carbuy', null, h('div.ui-item-name', { text: `New carriage (${s.carriages.length}/${api.data.config.maxCarriages})` }));
  const grid = h('div.ui-hab-grid');
  for (const hb of habs) {
    const a = { type: 'buyCarriage' as const, habitat: hb as Habitat };
    grid.append(costButton(ctx, habitatName(hb), api.price(a), () => {
      ctx.buy(a, row, { carId: `new`, kind: 'carriage', refId: hb });
    }, { cls: `hab hab-${hb}` }));
  }
  row.append(grid);
  list.append(row);
  list.append(h('h3.ui-sec', { text: 'Fish slots' }));
  for (const c of s.carriages) {
    const a = { type: 'buySlot' as const, carId: c.id };
    list.append(
      h(
        'div.ui-card.ui-row',
        null,
        h('span.ui-row-name', { text: `${carLabel(s, c.id)} · ${c.fish.length}/${c.slots} slots` }),
        costButton(ctx, '+1 slot', api.price(a), () => ctx.buy(a, list, { carId: c.id, kind: 'slot', refId: c.id })),
      ),
    );
  }
  list.append(h('h3.ui-sec', { text: 'Track' }));
  list.append(h('div.ui-card.ui-row', null, h('span.ui-row-name', { text: 'Extend the line' }), btn('ui-link', 'Open track map', () => ctx.open('track'))));
}

/** Sim car info for the gain estimate; null if the sim cannot describe the car. */
function safeCarInfo(ctx: UiCtx, carId: string): CarInfo | null {
  try {
    return ctx.api.sim.carInfo(carId);
  } catch {
    return null;
  }
}
