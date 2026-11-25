// T-36: Settings → Save code. Copy / download the save code, paste or pick a file to load one.
// Safety: the stored save is only written by `check.apply()` after a preview + double confirm.
import './saveTransfer.css';
import { saveFileName } from '../game/storage';
import { btn, h } from './dom';
import { confirmDialog, showModal } from './modal';
import type { UiCtx } from './panel';
import type { SaveCodeCheck, SavePreview } from './types';

const TIP = 'Moving to a new home-screen icon or device? Copy your save code first, then paste it there.';
const MAX_FILE_BYTES = 8_000_000;

function savedLabel(at: number | null): string {
  if (at === null) return 'unknown';
  try {
    return new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return new Date(at).toISOString();
  }
}

function previewRows(ctx: UiCtx, p: SavePreview): [string, string][] {
  const total = ctx.api.data.lines.length;
  return [
    ['Tickets', ctx.fmt(p.tickets)],
    ['Lines opened', `${p.openedLines.length} of ${total}`],
    ['Shells', ctx.fmt(p.shells)],
    ['Stamps', String(p.stamps)],
    ['Last saved', savedLabel(p.savedAt)],
  ];
}

/** Two-column card: this device now vs the pasted code. */
function previewCard(ctx: UiCtx, cur: SavePreview, inc: SavePreview): HTMLElement {
  const a = previewRows(ctx, cur);
  const b = previewRows(ctx, inc);
  const table = h('table.ui-sc-table', null, h('thead', null, h('tr', null, h('th'), h('th', { text: 'This device' }), h('th.inc', { text: 'Save code' }))));
  const body = h('tbody');
  a.forEach(([k, v], i) => body.append(h('tr', null, h('th', { text: k }), h('td', { text: v }), h('td.inc', { text: b[i]?.[1] ?? '' }))));
  table.append(body);
  return h('div.ui-sc-preview', null, table);
}

function short(p: SavePreview): string {
  return `${p.tickets} Ticket${p.tickets === 1 ? '' : 's'}, ${p.openedLines.length} Line${p.openedLines.length === 1 ? '' : 's'}`;
}

function openImportDialog(ctx: UiCtx): void {
  const { api } = ctx;
  const area = h('textarea.ui-sc-area', { placeholder: 'Paste your save code here (CE1.…)', rows: 3, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Save code' });
  const file = h('input', { type: 'file', accept: '.txt,text/plain', hidden: true, 'aria-hidden': 'true' });
  const err = h('p.ui-sc-err', { role: 'alert' });
  const pv = h('div.ui-sc-pv');
  const card = h('div.ui-dialog.ui-sc-dialog', { role: 'dialog', 'aria-label': 'Load save code' });
  let close = () => {};
  let busy = false;

  const fail = (msg: string) => {
    err.textContent = msg;
    pv.replaceChildren();
    api.emitUi?.('uiSound', { id: 'error' });
  };

  const showPreview = (r: Extract<SaveCodeCheck, { ok: true }>) => {
    err.textContent = '';
    const replace = btn('ui-brass danger', 'Replace current progress…', () =>
      confirmDialog({
        title: 'Replace current progress?',
        body: `This device’s trip (${short(r.current)}) will be replaced by the save code (${short(r.preview)}).`,
        ok: 'Replace',
        danger: true,
        onOk: () =>
          confirmDialog({
            title: 'Really replace it?',
            body: 'The trip on this device cannot be brought back from the menu afterwards.',
            ok: 'Load save code',
            danger: true,
            onOk: () => {
              if (r.apply()) {
                close();
                showModal(h('div.ui-dialog', { role: 'status' }, h('h2', { text: 'Loading your trip…' })), { sticky: true });
              } else {
                fail('This device would not store the save (storage full or blocked). Your current trip is unchanged.');
              }
            },
          }),
      }),
    );
    pv.replaceChildren(h('p.ui-sc-ok', { text: 'Save code looks good:' }), previewCard(ctx, r.current, r.preview), h('div.ui-dialog-btns', null, replace));
    // phone landscape: the dialog scrolls, bring the decision into view
    requestAnimationFrame(() => replace.scrollIntoView({ block: 'nearest' }));
  };

  const check = async () => {
    if (busy) return;
    if (!api.checkSaveCode) return fail('Loading save codes is not available in this build.');
    busy = true;
    try {
      const r = await api.checkSaveCode(area.value);
      if (r.ok) showPreview(r);
      else fail(r.error);
    } catch {
      fail('This save code could not be read. Your current trip is unchanged.');
    } finally {
      busy = false;
    }
  };

  file.addEventListener('change', () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) return fail('That file is far too big to be a save file.');
    f.text().then(
      (t) => {
        area.value = t.trim();
        void check();
      },
      () => fail('That file could not be read.'),
    );
  });

  card.append(
    h('h2', { text: 'Load save code' }),
    h('p', { text: 'Paste a save code, or choose a saved file. Nothing changes until you confirm.' }),
    area,
    file,
    h('div.ui-sc-row', null, btn('ui-brass ghost', 'Choose file…', () => file.click()), btn('ui-brass seafoam', 'Check code', () => void check())),
    err,
    pv,
    h('div.ui-dialog-btns', null, btn('ui-brass ghost', 'Close', () => close())),
  );
  close = showModal(card);
}

/** Save code section for the Settings panel. */
export function saveCodeSection(ctx: UiCtx): HTMLElement {
  const { api } = ctx;
  const status = h('p.ui-sc-status', { role: 'status' });
  const out = h('textarea.ui-sc-area.out', { readonly: true, rows: 3, spellcheck: 'false', 'aria-label': 'Your save code' });
  const outWrap = h('div.ui-sc-out', { hidden: true }, status, out, btn('ui-brass ghost', 'Select all', () => out.select()));

  const reveal = (code: string, msg: string) => {
    outWrap.hidden = false;
    out.value = code;
    status.textContent = msg;
  };

  const copy = () => {
    if (!api.exportSaveCode) return reveal('', 'Save codes are not available in this build.');
    const code = api.exportSaveCode();
    const clip = navigator.clipboard as Clipboard | undefined;
    let copied: Promise<void>;
    // Safari only allows clipboard writes inside the tap: hand it a promise of the text right away.
    if (clip?.write && typeof ClipboardItem === 'function') {
      copied = clip
        .write([new ClipboardItem({ 'text/plain': code.then((c) => new Blob([c], { type: 'text/plain' })) })])
        .catch(() => code.then((c) => clip.writeText(c)));
    } else if (clip?.writeText) {
      copied = code.then((c) => clip.writeText(c));
    } else {
      copied = Promise.reject(new Error('no clipboard'));
    }
    copied.catch(() => {}); // handled below; avoids an unhandled rejection if the code itself fails
    code.then(
      (c) =>
        copied.then(
          () => {
            reveal(c, 'Copied! On the new icon or device: Settings → Load save code → paste.');
            api.emitUi?.('uiSound', { id: 'click' });
          },
          () => {
            reveal(c, 'Couldn’t reach the clipboard. Your code is selected below: copy it by hand.');
            out.focus();
            out.select();
          },
        ),
      () => reveal('', 'Could not make a save code right now. Try again in a moment.'),
    );
  };

  const download = () => {
    if (!api.exportSaveCode) return;
    api.exportSaveCode().then(
      (c) => {
        const url = URL.createObjectURL(new Blob([c + '\n'], { type: 'text/plain' }));
        const a = h('a', { href: url, download: saveFileName(new Date()) });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        reveal(c, 'Save file downloaded. Your code is also shown below.');
      },
      () => reveal('', 'Could not make a save file right now. Try again in a moment.'),
    );
  };

  return h(
    'div.ui-sc',
    null,
    h('h3.ui-sec', { text: 'Save code' }),
    h('p.ui-hint', { text: TIP }),
    h(
      'div.ui-sc-btns',
      null,
      btn('ui-brass seafoam', 'Copy save code', copy),
      btn('ui-brass ghost', 'Download save file', download),
      btn('ui-brass', 'Load save code…', () => openImportDialog(ctx)),
    ),
    outWrap,
  );
}
