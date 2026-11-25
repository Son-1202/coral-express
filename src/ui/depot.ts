// Depot: reset (Tickets preview + new multiplier), Mascot picker, Line picker, upgrades, lifetime stats.
import type { LineId } from '../data/schema';
import { iconImg, lineCover } from './art';
import { speciesName, stationName } from './content';
import { btn, fishIcon, h, TICKET } from './dom';
import { defaultMascotName, depotChecklist, describeUpgrade, formatDuration, lineLockText } from './helpers';
import { confirmDialog } from './modal';
import { carLabel } from './cars';
import { costButton, type PanelView, type UiCtx } from './panel';

let mascotId = '';

let mascotName = '';
let nameTouched = false;
let nextLine: LineId = 1;

/** Live parts of the open Depot panel, refreshed in place by `tick()` (no re-render: keeps input focus). */
interface Live {
  card: HTMLElement;
  list: HTMLElement;
  go: HTMLButtonElement;
  hasMascot: boolean;
  sig: string;
}
let live: Live | null = null;

export function depotPanel(ctx: UiCtx): PanelView {
  const { api } = ctx;
  return {
    id: 'depot',
    title: () => 'The Depot',
    subtitle: () => `Tickets ${ctx.fmt(api.sim.state.permanent.tickets)} · income ×${api.sim.depotPreview().incomeMult.toFixed(1)}`,
    watch: ['upgradeBought', 'depotReset', 'terminalReached', 'lineOpened', 'purchase', 'sale'],
    tick() {
      if (live && live.go.isConnected) updateLive(ctx, live);
    },
    render(body) {
      const s = api.sim.state;
      const p = s.permanent;
      const c = api.data.config;

      // reset card (filled by updateLive from the sim's depotPreview)
      const reset = h('div.ui-card.ui-reset');
      const checklist = h('ul.ui-checklist', { 'aria-label': 'Depot Reset checklist' });

      // mascot picker
      // one candidate per species (+ shiny variant): its highest-level fish
      const bestBy = new Map<string, (typeof s.fish)[string]>();
      for (const f of Object.values(s.fish)) {
        const k = `${f.species}|${f.shiny}`;
        const cur = bestBy.get(k);
        if (!cur || f.level > cur.level || f.mascot) bestBy.set(k, f);
      }
      const fish = [...bestBy.values()].sort((a, b) => b.level - a.level);
      if (!fish.some((f) => f.id === mascotId)) {
        const best = [...fish].sort((a, b) => b.level - a.level)[0];
        mascotId = best?.id ?? '';
        nameTouched = false;
      }
      const chosen = s.fish[mascotId];
      if (!nameTouched && chosen) mascotName = defaultMascotName(api.data, chosen.species, chosen.nickname);
      const picker = h('div.ui-mascots');
      for (const f of fish) {
        const b = btn(`ui-mascot${f.id === mascotId ? ' on' : ''}`, h('span', null, fishIcon(api.data, f.species, f.shiny, 40), h('small', { text: f.nickname ?? speciesName(api.data, f.species) }), h('em', { text: `Lv ${f.level}` })), () => {
          mascotId = f.id;
          nameTouched = false;
          ctx.rerender();
        }, { title: carLabel(s, f.carId) });
        if (f.id === mascotId) b.append(h('i.ui-cap'));
        picker.append(b);
      }
      const name = h('input.ui-input', { value: mascotName, maxlength: 16, placeholder: 'Name your mascot', 'aria-label': 'Mascot name' });
      name.addEventListener('input', () => {
        mascotName = name.value;
        nameTouched = true;
      });
      name.addEventListener('keydown', (e) => e.stopPropagation());
      const streak = p.mascot && chosen && p.mascot.species === chosen.species ? p.oldFriendStreak + 1 : 1;
      const friend = p.oldFriend ? 'Old Friend bonus active (+25% forever).' : `Same species ${c.mascot.oldFriendStreak}× in a row = Old Friend (+${Math.round(c.mascot.oldFriendBonus * 100)}%). Streak after reset: ${streak}.`;

      // line picker
      const opened = p.openedLines;
      if (!opened.includes(nextLine)) nextLine = s.currentLine;
      const lines = h('div.ui-lines pick');
      for (const l of api.data.lines) {
        const open = opened.includes(l.id);
        lines.append(
          btn(`ui-line-card${open ? ' open' : ' locked'}${l.id === nextLine ? ' cur' : ''}`, h('span', null, lineCover(l.id, open), h('b', { text: l.name }), h('span', { text: l.region }), h('small', { text: open ? (l.id === nextLine ? 'Selected' : 'Ride this line') : lineLockText(api.data, s, l.id) })), () => {
            if (!open) return;
            nextLine = l.id;
            ctx.rerender();
          }, { style: `--sky:${l.palette.sky};--sea:${l.palette.sea};--land:${l.palette.land}`, disabled: !open }),
        );
      }

      const go = btn('ui-brass big', h('span', { html: `${TICKET} Depot Reset` }), () => {
        const pv = api.sim.depotPreview();
        if (!pv.eligible || !chosen) return;
        const body2 = h(
          'div.ui-confirm-body',
          null,
          h('p', { html: `You'll gain <b>${ctx.fmt(pv.tickets)} Ticket${pv.tickets === 1 ? '' : 's'}</b> and income goes to <b>×${pv.incomeMultAfter.toFixed(1)}</b>.` }),
          h('p', null, fishIcon(api.data, chosen.species, chosen.shiny, 32), ` ${mascotName || speciesName(api.data, chosen.species)} rides on as Mascot in the Heritage Carriage.`),
          h('p.ui-item-desc', { text: 'Shells, fish, carriages and track go to the depot pools. Stamps, postcards, upgrades and the Heritage Carriage stay.' }),
        );
        confirmDialog({
          title: 'Pull into the Depot?',
          body: body2,
          ok: 'Reset & ride',
          onOk: () => {
            const r = api.act({ type: 'depotReset', mascotFishId: chosen.id, nextLine, ...(mascotName.trim() ? { mascotName: mascotName.trim() } : {}) });
            ctx.sound(r.ok ? 'coin' : 'error');
            if (r.ok) ctx.close();
          },
        });
      });
      live = { card: reset, list: checklist, go, hasMascot: !!chosen, sig: '' };
      updateLive(ctx, live);

      body.append(
        reset,
        h('h3.ui-sec', { text: 'Choose your Mascot' }),
        fish.length ? picker : h('p.ui-empty', { text: 'No fish aboard yet.' }),
        h('label.ui-field', null, h('span', { text: 'Name' }), name),
        h('p.ui-hint', { text: friend }),
        h('h3.ui-sec', { text: 'Next line' }),
        lines,
        checklist,
        go,
      );

      // upgrades
      body.append(h('h3.ui-sec', { html: `Upgrades <span class="ui-sec-n">${TICKET} ${ctx.fmt(p.tickets)}</span>` }));
      const ups = h('div.ui-list');
      for (const u of api.data.upgrades) {
        const owned = p.upgrades.includes(u.id);
        const icon = iconImg(`upgrade_${u.id}`, 'ui-up-ico') ?? h('i.ui-up-ico.ph', { text: u.name[0] });
        const a = { type: 'buyUpgrade' as const, id: u.id };
        ups.append(
          h(
            'div.ui-card.ui-item' + (owned ? '.owned' : ''),
            null,
            icon,
            h('div.ui-item-main', null, h('div.ui-item-name', { text: u.name }), h('div.ui-item-desc', { text: describeUpgrade(u) })),
            h('div.ui-item-side', null, owned ? h('span.ui-stamp-done', { text: 'Owned' }) : costButton(ctx, 'Buy', u.cost, () => ctx.buy(a), { tickets: true })),
          ),
        );
      }
      body.append(ups);

      // lifetime
      const L = s.lifetime;
      const stats: [string, string][] = [
        ['Shells earned', ctx.fmt(L.shellsEarned)],
        ['From fish', ctx.fmt(L.fishShells)],
        ['From fares', ctx.fmt(L.fareShells)],
        ['Arrivals', ctx.fmt(L.arrivals)],
        ['Fish bought', ctx.fmt(L.fishBought)],
        ['Requests met', ctx.fmt(L.requestsCompleted)],
        ['Depot resets', ctx.fmt(p.resets)],
        ['Tickets earned', ctx.fmt(p.totalTicketsEarned)],
        ['Time aboard', formatDuration(L.playSeconds)],
      ];
      body.append(h('h3.ui-sec', { text: 'Lifetime' }), h('dl.ui-stats', null, ...stats.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])));
    },
  };
}

/** Refresh the reset card, checklist and button from the sim (cheap no-op when nothing changed). */
function updateLive(ctx: UiCtx, l: Live): void {
  const { api } = ctx;
  const pv = api.sim.depotPreview();
  const line = api.sim.state.currentLine;
  const cl = depotChecklist(pv, ctx.fmt, (i) => stationName(line, i));
  const ready = pv.eligible && l.hasMascot;
  const sig = [ready, cl.summary, ...cl.rows.map((r) => `${r.ok}${r.text}`)].join('|');
  if (sig === l.sig) return;
  l.sig = sig;
  l.card.classList.toggle('ready', ready);
  l.card.replaceChildren(
    h('div.ui-reset-tickets', null, h('span', { html: TICKET }), h('b', { text: `+${ctx.fmt(pv.tickets)}` }), h('small', { text: pv.tickets === 1 ? 'Ticket' : 'Tickets' })),
    h('div.ui-reset-mult', { html: `income <b>×${pv.incomeMult.toFixed(1)}</b> → <b class="up">×${pv.incomeMultAfter.toFixed(1)}</b>` }),
    h('p.ui-item-desc', { text: `Next Ticket at ${ctx.fmt(pv.nextTicketAt)} Shells this run` }),
  );
  l.list.replaceChildren(
    ...cl.rows.map((r) => h(`li.ui-check${r.ok ? '.ok' : '.no'}`, null, h('i', { 'aria-hidden': 'true' }), h('span', { text: r.text }))),
    h('li.ui-check-sum' + (pv.eligible ? '.ready' : ''), { text: cl.summary }),
  );
  l.go.disabled = !ready;
  l.go.classList.toggle('off', !ready);
  if (cl.blocked) l.go.title = cl.blocked;
  else l.go.removeAttribute('title');
}
