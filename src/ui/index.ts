// UI entry: mountUI(root, api) builds HUD, side panels, modals, toasts, tutorial, title.
import { formatNumber } from '../util/format';
import type { Action, SimEvent } from '../sim';
import { carPanel } from './carDetail';
import { stationName } from './content';
import { depotPanel } from './depot';
import { h } from './dom';
import { legProgress } from './helpers';
import { Hud, mountRotateCard } from './hud';
import { marketPanel, openMarketTab } from './market';
import { closeTopModal, initModals, modalOpen } from './modal';
import { applyIconVars } from './art';
import { PanelHost, refreshCost, type PanelView, type UiCtx } from './panel';
import { settingsPanel } from './settings';
import { stampsPanel } from './stampBook';
import { showTitle } from './title';
import { showOffline } from './offline';
import { Toasts, wireToasts } from './toasts';
import { trackPanel } from './trackMap';
import { Tutorial } from './tutorial';
import type { GameApi, PanelId, UIEvents } from './types';
import endingJson from '../story/ending.json';
import './panels.css';
import './screens.css';

export type { GameApi, UIEvents, PanelId } from './types';

export interface MountOpts {
  /** Show the title screen first (default true). */
  title?: boolean;
  /** Mount the rotate-phone card (default true). */
  rotateCard?: boolean;
}

export interface UiHandle {
  open(id: PanelId, arg?: string): void;
  close(): void;
  /** Show a plain info toast (controller hooks, e.g. after the ending). */
  toast(title: string, text?: string, ms?: number): void;
  readonly hud: Hud;
  destroy(): void;
}

const KEYS: Record<string, PanelId> = { m: 'market', t: 'track', s: 'stamps', d: 'depot' };

export function mountUI(root: HTMLElement, api: GameApi, opts: MountOpts = {}): UiHandle {
  const layer = h('div.ui-root');
  applyIconVars(document.documentElement);
  root.appendChild(layer);
  const offs: (() => void)[] = [];
  let tutorial: Tutorial | null = null;

  const emitUi = <K extends keyof UIEvents>(type: K, payload: UIEvents[K]) => api.emitUi?.(type, payload);

  const host = new PanelHost(layer, () => ui.close());
  const ctx: UiCtx = {
    api,
    arg: null,
    fmt: (n) => formatNumber(n, api.getSettings().numberFormat),
    open: (id, arg) => ui.open(id, arg),
    close: () => ui.close(),
    rerender: () => host.render(),
    toast: (t) => toasts.push(t),
    sound: (id, amount) => emitUi('uiSound', amount === undefined ? { id } : { id, amount }),
    buy(a: Action, from?: HTMLElement, fly?: UIEvents['itemFly']) {
      const cost = api.price(a);
      const r = api.act(a);
      if (!r.ok) {
        ctx.sound('error');
        if (from) {
          from.classList.remove('shake');
          void from.offsetWidth;
          from.classList.add('shake');
        }
        return false;
      }
      ctx.sound('coin', cost ?? 0);
      if (fly) {
        emitUi('itemFly', fly);
        if (from) flyFrom(from);
      }
      host.schedule();
      return true;
    },
  };

  const views: Record<PanelId, PanelView> = {
    market: marketPanel(ctx),
    track: trackPanel(ctx),
    stamps: stampsPanel(ctx),
    depot: depotPanel(ctx),
    settings: settingsPanel(ctx),
    car: carPanel(ctx),
  };

  const hud = new Hud(layer, (id) => (host.current?.id === id ? ui.close() : ui.open(id as PanelId)));
  const cog = h('button.ui-cog', { type: 'button', 'aria-label': 'Settings', title: 'Settings' });
  cog.addEventListener('click', () => (host.current?.id === 'settings' ? ui.close() : ui.open('settings')));
  layer.append(cog);
  if (opts.rotateCard !== false) mountRotateCard(layer);
  initModals(layer);
  const toasts = new Toasts(layer);
  offs.push(wireToasts(ctx, toasts));

  const ui: UiHandle = {
    hud,
    open(id, arg) {
      const v = views[id];
      if (!v) return;
      ctx.arg = arg ?? (id === 'car' ? api.selectedCar() ?? api.sim.state.carriages[0]?.id ?? null : null);
      if (id === 'car' && ctx.arg) api.selectCar(ctx.arg);
      if (host.current?.id !== id) ctx.sound('open');
      host.show(v);
      hud.root.querySelectorAll<HTMLElement>('.hud-btn').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
      tutorial?.panelOpened(id);
    },
    close() {
      if (!host.current) return;
      ctx.sound('close');
      host.hide();
      hud.root.querySelectorAll('.hud-btn.on').forEach((b) => b.classList.remove('on'));
    },
    toast(title, text, ms) {
      toasts.push({ kind: 'info', title, ...(text ? { text } : {}), ...(ms ? { ms } : {}) });
    },
    destroy() {
      offs.forEach((o) => o());
      tutorial?.dispose();
      window.removeEventListener('keydown', onKey);
      layer.remove();
    },
  };

  // ---- events ----
  offs.push(
    api.on('*', (e: SimEvent) => {
      const v = host.current;
      if (v && v.watch.includes(e.type)) host.schedule();
    }),
    api.on('carDetail', (e) => ui.open('car', e.carId)),
    api.on('openPanel', (e) => {
      const [id, sub] = e.id.split(':');
      if (id === 'market' && sub) openMarketTab(sub);
      if (id in views) ui.open(id as PanelId, id === 'car' ? sub : undefined);
    }),
    api.on('tankView', (e) => {
      document.body.classList.toggle('ui-tank', !!e.carId);
      if (e.carId) ui.close();
    }),
    api.on('ending', () => offs.push(afterEnding(() => ui.toast('Endless mode', ENDLESS_TOAST, 9000)))),
    api.on('settings', () => host.schedule()),
    api.on('depotReset', () => host.schedule()),
  );
  // the canvas may also emit the UIEvents names on the bus
  const onAny = api.on as unknown as (t: string, cb: (e: { carId?: string; id?: string }) => void) => () => void;
  offs.push(onAny('openCarDetail', (e) => e.carId && ui.open('car', e.carId)));

  // ---- HUD + cost refresh ----
  let costTimer = 0;
  const update = (dt: number) => {
    const s = api.sim.state;
    const st = api.sim.stats();
    const leg = api.legSeconds?.() ?? api.data.config.legSeconds;
    const p = legProgress(s, leg, api.data.config.stopSeconds);
    const tr = s.train;
    hud.update({
      shells: s.shells,
      shellsPerSec: st.totalSps,
      tickets: s.permanent.tickets,
      progress: p.atStation ? 1 : p.progress,
      eta: p.eta,
      stationLabel: tr.phase === 'stopped' ? `At ${stationName(s.currentLine, tr.fromStation)}` : `Next: ${stationName(s.currentLine, tr.toStation)}`,
    }, formatFor());
    costTimer += dt;
    if (costTimer >= 0.4 && host.current) {
      costTimer = 0;
      host.body.querySelectorAll<HTMLElement>('[data-cost]').forEach((b) => refreshCost(ctx, b));
    }
  };
  const formatFor = () => api.getSettings().numberFormat;
  offs.push(api.on('frame', (e) => update(e.dt)));
  update(0);

  // ---- keyboard ----
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (closeTopModal()) return;
      if (host.current) return ui.close();
      if (document.body.classList.contains('ui-tank')) api.exitTankView();
      return;
    }
    if (modalOpen() || layer.querySelector('.ui-title')) return;
    const id = KEYS[e.key.toLowerCase()];
    if (id) {
      e.preventDefault();
      if (host.current?.id === id) ui.close();
      else ui.open(id);
    }
  };
  window.addEventListener('keydown', onKey);

  // ---- title → offline → tutorial ----
  const afterTitle = () => {
    api.setPaused?.(false);
    const rep = api.offlineReport ? api.offlineReport() : api.sim.offlineReport;
    if (rep && rep.seconds >= 60) showOffline(ctx, rep);
    tutorial = new Tutorial(layer, ctx);
    tutorial.start();
  };
  if (opts.title !== false) {
    api.setPaused?.(true);
    const rep = api.offlineReport ? api.offlineReport() : api.sim.offlineReport;
    const hasSave = api.hasSave ? api.hasSave() : api.sim.state.lifetime.fishBought > 0;
    showTitle(layer, ctx, { hasSave, away: rep?.seconds ?? null, onContinue: afterTitle, onSettings: () => ui.open('settings') });
  } else afterTitle();

  return ui;
}

const ENDLESS_TOAST = endingJson.endlessToast;

/**
 * Run `cb` once the Grand Terminus overlay (`.ending`, mounted by the controller on the same
 * `ending` event) has closed — or right away when there is none. Returns a cancel fn.
 */
function afterEnding(cb: () => void): () => void {
  const t0 = performance.now();
  const timer = setInterval(() => {
    const el = document.querySelector('.ending');
    if (el && !el.classList.contains('out')) return;
    if (performance.now() - t0 < 600) return; // let the overlay mount first
    clearInterval(timer);
    cb();
  }, 250);
  return () => clearInterval(timer);
}

/** DOM "item flies to the train" flourish from a market card. */
function flyFrom(from: HTMLElement): void {
  const src = from.querySelector<HTMLElement>('.ui-fish, .ui-decor, .ui-special-icon') ?? from;
  const r = src.getBoundingClientRect();
  const ghost = src.cloneNode(true) as HTMLElement;
  ghost.classList.add('ui-fly');
  ghost.style.left = `${r.left}px`;
  ghost.style.top = `${r.top}px`;
  ghost.style.width = `${r.width}px`;
  ghost.style.height = `${r.height}px`;
  const panelW = document.querySelector('.ui-panel')?.getBoundingClientRect().width ?? 0;
  const tx = (window.innerWidth - panelW) * 0.5 - r.left - r.width / 2;
  const ty = window.innerHeight * 0.62 - r.top - r.height / 2;
  ghost.style.setProperty('--tx', `${tx}px`);
  ghost.style.setProperty('--ty', `${ty}px`);
  document.body.appendChild(ghost);
  setTimeout(() => ghost.remove(), 800);
}
