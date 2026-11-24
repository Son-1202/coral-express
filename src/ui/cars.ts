// Carriage labels + the target-carriage picker shared by Market and Special.
import type { SimState } from '../sim';
import { btn, h, habitatName } from './dom';
import type { UiCtx } from './panel';

export function carIndex(s: SimState, carId: string): number {
  return s.carriages.findIndex((c) => c.id === carId);
}

/** "Heritage" for the first car, else "Car N". */
export function carLabel(s: SimState, carId: string): string {
  const i = carIndex(s, carId);
  const c = s.carriages[i];
  if (!c) return 'new carriage';
  return c.heritage ? 'Heritage' : `Car ${i + 1}`;
}

/** Row of carriage chips (habitat colour + free slots). `auto` adds a "Best" chip. */
export function carPicker(ctx: UiCtx, value: string, auto: boolean, onPick: (id: string) => void): HTMLElement {
  const s = ctx.api.sim.state;
  const row = h('div.ui-carpick');
  if (auto) row.append(btn(`ui-carchip auto${value === 'auto' ? ' on' : ''}`, h('span', { html: '<b>Best</b><small>auto</small>' }), () => onPick('auto')));
  s.carriages.forEach((c, i) => {
    const full = c.fish.length >= c.slots;
    const b = btn(
      `ui-carchip hab-${c.habitat}${value === c.id ? ' on' : ''}${full ? ' full' : ''}`,
      h('span', { html: `<b>${c.heritage ? '★' : i + 1}</b><small>${habitatName(c.habitat)} ${c.fish.length}/${c.slots}</small>` }),
      () => onPick(c.id),
      { title: `${carLabel(s, c.id)} — ${habitatName(c.habitat)}, ${c.fish.length}/${c.slots} slots` },
    );
    row.append(b);
  });
  return row;
}
