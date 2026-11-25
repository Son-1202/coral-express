// Track map: stylised line map of the current Line + other Lines locked/open.
import { stationName } from './content';
import { h } from './dom';
import { lineLockText } from './helpers';
import { costButton, type PanelView, type UiCtx } from './panel';

export function trackPanel(ctx: UiCtx): PanelView {
  const { api } = ctx;
  return {
    id: 'track',
    title: () => 'Track Map',
    subtitle: () => {
      const l = api.data.lines.find((x) => x.id === api.sim.state.currentLine);
      return l ? `${l.name} · ${l.region}` : '';
    },
    watch: ['trackBuilt', 'arrive', 'depart', 'lineOpened', 'depotReset'],
    render(body) {
      const s = api.sim.state;
      const n = api.data.config.stationsPerLine;
      const line = api.data.lines.find((x) => x.id === s.currentLine);
      const map = h('div.ui-map', { style: `--accent:${line?.palette.accent ?? '#f6c94a'};--sea:${line?.palette.sea ?? '#3cc7c4'};--land:${line?.palette.land ?? '#f3d9a4'}` });
      const tr = s.train;
      const trainPos = tr.phase === 'stopped' ? tr.fromStation : tr.fromStation + (tr.toStation - tr.fromStation) * 0.5;
      for (let k = 1; k <= n; k++) {
        const built = k <= s.builtTo;
        const next = k === s.builtTo + 1;
        const here = tr.phase === 'stopped' && tr.fromStation === k;
        const visited = s.visitedThisRun.includes(k);
        const stop = h(
          `div.ui-stop${built ? '.built' : ''}${next ? '.next' : ''}${here ? '.here' : ''}${k === n ? '.terminal' : ''}`,
          { style: `--i:${k - 1}` },
          h('span.ui-stop-dot', { text: String(k) }),
          h('span.ui-stop-name', { text: stationName(s.currentLine, k) }),
          k === n ? h('span.ui-stop-tag', { text: 'Terminal' }) : null,
          visited && !here ? h('span.ui-stop-tag.v', { text: 'visited' }) : null,
        );
        if (k < n) stop.append(h(`i.ui-rail${k < s.builtTo ? '.built' : ''}${k === s.builtTo ? '.next' : ''}`));
        map.append(stop);
      }
      map.append(h('div.ui-map-train', { style: `--p:${(trainPos - 1) / (n - 1)}`, title: 'The Coral Express' }));
      body.append(map);

      const a = { type: 'buildTrack' as const };
      const cost = api.price(a);
      if (s.builtTo < n) {
        body.append(
          h(
            'div.ui-card.ui-build',
            null,
            h('div', null, h('div.ui-item-name', { text: `Extend to ${stationName(s.currentLine, s.builtTo + 1)}` }), h('p.ui-item-desc', { text: s.builtTo + 1 === n ? 'The terminal! Reaching it opens the Depot Reset.' : 'New station, new stalls, bigger fares.' })),
            costButton(ctx, 'Build', cost, () => ctx.buy(a), { cls: 'wide' }),
          ),
        );
      } else {
        body.append(h('div.ui-card.ui-build.done', null, h('div.ui-item-name', { text: 'The whole line is built!' }), h('p.ui-item-desc', { text: s.terminalReachedThisRun ? 'Terminal reached — visit the Depot when you are ready.' : 'Ride to the terminal to complete the line.' })));
      }

      body.append(h('h3.ui-sec', { text: 'Lines' }));
      const lines = h('div.ui-lines');
      for (const l of api.data.lines) {
        const open = s.permanent.openedLines.includes(l.id);
        const cur = l.id === s.currentLine;
        lines.append(
          h(
            `div.ui-line-card${open ? '.open' : '.locked'}${cur ? '.cur' : ''}`,
            { style: `--sky:${l.palette.sky};--sea:${l.palette.sea};--land:${l.palette.land}` },
            h('b', { text: l.name }),
            h('span', { text: l.region }),
            h('small', { text: cur ? 'Riding now' : open ? 'Open — pick it at the Depot' : lineLockText(api.data, s, l.id) }),
          ),
        );
      }
      body.append(lines);
    },
  };
}
