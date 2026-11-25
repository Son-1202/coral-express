// "While you were away" postcard (offline earnings popup), with painted art (QA bug 11):
// the last visited station's postcard painting, else the Line cover, else the procedural sun.
import { fileUrl, hasFile } from '../assets';
import type { OfflineResult, SimState } from '../sim';
import { stationName } from './content';
import { btn, h, SHELL } from './dom';
import { formatDuration } from './helpers';
import { showModal } from './modal';
import type { UiCtx } from './panel';
import './offline.css';

type AwayState = Pick<SimState, 'currentLine' | 'marketStation' | 'train'>;

/** 1-based station the player last saw on the current Line. */
export function lastStation(s: AwayState): number {
  return Math.max(1, s.marketStation || s.train.fromStation || 1);
}

/** Painted art for the popup: `ui/postcard_l<line>s<n>` → `ui/line_cover_<line>` → null (procedural). */
export function awayArt(s: AwayState, exists: (path: string) => boolean = hasFile): string | null {
  const pc = `/ui/postcard_l${s.currentLine}s${lastStation(s)}.png`;
  if (exists(pc)) return pc;
  const cover = `/ui/line_cover_${s.currentLine}.png`;
  return exists(cover) ? cover : null;
}

export function showOffline(ctx: UiCtx, r: OfflineResult): void {
  const s = ctx.api.sim.state;
  const line = s.currentLine;
  const art = awayArt(s);
  const where = stationName(line, lastStation(s));
  const artEl = art
    ? h('div.ui-pc-art.ui-away-art', { 'data-line': line, style: `background-image:url("${fileUrl(art, true)}")` }, h('span.ui-away-plate', { text: 'While you were away' }), h('small.ui-away-where', { text: where }))
    : h('div.ui-pc-art.ph.away', { 'data-line': line }, h('span', { text: 'While you were away' }));
  let close = () => {};
  const card = h(
    'div.ui-postcard.ui-offline',
    null,
    artEl,
    h(
      'div.ui-pc-back',
      null,
      h('div.ui-pc-stamp', { 'data-line': line }),
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
