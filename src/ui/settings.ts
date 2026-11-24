// Settings: music/SFX volume, quality, number format, reset save (double confirm).
import { formatNumber } from '../util/format';
import { btn, h } from './dom';
import { confirmDialog } from './modal';
import type { PanelView, UiCtx } from './panel';
import type { Settings } from './types';

function segmented<T extends string>(value: T, opts: [T, string][], onPick: (v: T) => void): HTMLElement {
  const row = h('div.ui-seg', { role: 'radiogroup' });
  for (const [v, label] of opts) row.append(btn(`ui-seg-btn${v === value ? ' on' : ''}`, label, () => onPick(v), { role: 'radio', 'aria-checked': v === value ? 'true' : 'false' }));
  return row;
}

function slider(label: string, value: number, onChange: (v: number) => void): HTMLElement {
  const out = h('output', { text: `${Math.round(value * 100)}%` });
  const input = h('input.ui-range', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(value * 100), 'aria-label': label });
  input.style.setProperty('--v', `${Math.round(value * 100)}%`);
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    out.textContent = `${input.value}%`;
    input.style.setProperty('--v', `${input.value}%`);
    onChange(v);
  });
  return h('label.ui-field.slider', null, h('span', { text: label }), input, out);
}

export function settingsPanel(ctx: UiCtx): PanelView {
  const { api } = ctx;
  const set = (p: Partial<Settings>, rerender = true) => {
    api.setSettings(p);
    if (rerender) ctx.rerender();
  };
  return {
    id: 'settings',
    title: () => 'Settings',
    subtitle: () => 'Conductor’s cabin',
    watch: [],
    render(body) {
      const st = api.getSettings();
      body.append(
        h('h3.ui-sec', { text: 'Sound' }),
        slider('Music', st.musicVolume, (v) => set({ musicVolume: v }, false)),
        slider('Sound effects', st.sfxVolume, (v) => set({ sfxVolume: v }, false)),
        h('h3.ui-sec', { text: 'Graphics quality' }),
        segmented(st.quality, [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']], (v) => set({ quality: v })),
        h('h3.ui-sec', { text: 'Numbers' }),
        segmented(st.numberFormat, [['short', `Short · ${formatNumber(1234567, 'short')}`], ['scientific', `Science · ${formatNumber(1234567, 'scientific')}`]], (v) => set({ numberFormat: v })),
        h('h3.ui-sec', { text: 'Save' }),
        h('p.ui-hint', { text: 'Your trip is saved in this browser automatically.' }),
        btn('ui-brass danger', 'Reset save…', () =>
          confirmDialog({
            title: 'Reset your save?',
            body: 'Everything — Tickets, stamps, postcards and the Heritage Carriage — will be lost.',
            ok: 'Yes, reset',
            danger: true,
            onOk: () =>
              confirmDialog({
                title: 'Really sure?',
                body: 'This cannot be undone. Wren’s train starts again from Lemonbay Halt.',
                ok: 'Erase everything',
                danger: true,
                onOk: () => (api.resetSave ?? api.newGame)?.(),
              }),
          }),
        ),
      );
    },
  };
}
