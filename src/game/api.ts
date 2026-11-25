import type { GameApi, UIEvents } from '../ui/types';
import type { Settings } from './bus';
import type { GameController } from './controller';
import { clearSave, decodeSaveCode, encodeSaveCode, readSettings, writeSettings } from './storage';
import type { SaveCodeCheck } from '../ui/types';

/** Reload without `?new=1` / `?warp=` (those would start fresh or fast-forward over an import). */
function reloadClean(): void {
  const u = new URL(location.href);
  u.searchParams.delete('new');
  u.searchParams.delete('warp');
  if (u.href === location.href) location.reload();
  else location.replace(u.href);
}

/** Hooks the render side provides to the API (Tank View lives in T-15's module). */
export interface ApiHooks {
  enterTankView(carId: string): void;
  exitTankView(): void;
  onSelect(carId: string | null): void;
  onSettings(s: Settings): void;
}

export interface GameApiImpl extends GameApi {
  /** Debug helpers (also on window.__debug). */
  debug: Record<string, unknown>;
}

/** The UI contract (src/ui/types.ts, T-14) implemented on top of the controller. */
export function createApi(game: GameController, hooks: ApiHooks, hadSave: boolean): GameApiImpl {
  let settings = readSettings();
  let selected: string | null = null;
  const api: GameApiImpl = {
    sim: game.sim,
    data: game.data,
    story: game.story,
    act: (a) => game.sim.act(a),
    price: (a) => game.sim.price(a),
    on: (type, cb) => game.bus.on(type, cb),
    getSettings: () => settings,
    setSettings(p) {
      settings = { ...settings, ...p };
      writeSettings(settings);
      hooks.onSettings(settings);
      game.bus.emit('settings', settings);
    },
    selectCar(id) {
      selected = id && game.sim.state.carriages.some((c) => c.id === id) ? id : null;
      hooks.onSelect(selected);
      if (selected) game.bus.emit('selectCar', { carId: selected });
    },
    selectedCar: () => (selected && game.sim.state.carriages.some((c) => c.id === selected) ? selected : null),
    enterTankView: (carId) => hooks.enterTankView(carId),
    exitTankView: () => hooks.exitTankView(),
    emitUi<K extends keyof UIEvents>(type: K, payload: UIEvents[K]) {
      // UI → render/audio events travel on the same bus (string-typed extension)
      (game.bus.emit as unknown as (t: string, p: unknown) => void)(type, payload);
    },
    legSeconds: () => game.legSeconds(),
    offlineReport: () => game.loadOfflineReport,
    hasSave: () => hadSave,
    newGame() {
      clearSave();
      game.stop();
      location.reload();
    },
    resetSave() {
      clearSave();
      game.stop();
      location.reload();
    },
    // T-36 save transfer (logic lives in storage.ts + controller.ts)
    exportSaveCode: () => encodeSaveCode(game.exportSave()),
    async checkSaveCode(code): Promise<SaveCodeCheck> {
      const r = await decodeSaveCode(code);
      if (!r.ok) return r;
      try {
        const preview = game.previewImport(r.save);
        return { ok: true, preview, current: game.currentPreview(), apply: () => game.applyImport(r.save) && (reloadClean(), true) };
      } catch (err) {
        console.warn('[save] imported save does not load', err);
        return { ok: false, error: 'This save code could not be loaded. Your current trip is unchanged.' };
      }
    },
    setPaused: (p) => {
      game.paused = p;
    },
    debug: {},
  };
  return api;
}
