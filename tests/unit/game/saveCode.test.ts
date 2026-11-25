// T-36: save code export / import.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGameData } from '../../../src/data/schema';
import { GameController } from '../../../src/game/controller';
import {
  BACKUP_KEY, CODE_ERRORS, decodeSaveCode, encodeSaveCode, readSaveRaw, replaceSave, SAVE_KEY, saveFileName,
} from '../../../src/game/storage';
import { createSim, SAVE_VERSION, type SaveData } from '../../../src/sim';

class MemStorage {
  m = new Map<string, string>();
  failWrites = false;
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { if (this.failWrites) throw new Error('QuotaExceededError'); this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

let store: MemStorage;
beforeEach(() => {
  store = new MemStorage();
  vi.stubGlobal('window', { localStorage: store });
});
afterEach(() => vi.unstubAllGlobals());

/** A progressed game: a few minutes of play, Tickets and a second Line. */
function progressed(): SaveData {
  const sim = createSim(loadGameData(), { seed: 7 });
  sim.advance(600);
  const s = sim.state;
  s.permanent.tickets = 5;
  s.permanent.totalTicketsEarned = 9;
  if (!s.permanent.openedLines.includes(2)) s.permanent.openedLines.push(2);
  s.shells = 123456.5;
  return sim.serialize(1_764_000_000_000);
}

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const code0 = (o: unknown) => `CE0.${b64url(JSON.stringify(o))}`;

describe('save code round trip', () => {
  it('compressed CE1 code decodes to the identical save', async () => {
    const save = progressed();
    const code = await encodeSaveCode(save);
    expect(code.startsWith('CE1.')).toBe(true);
    expect(code).toMatch(/^CE1\.[A-Za-z0-9_-]+$/);
    const r = await decodeSaveCode(code);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.save)).toBe(JSON.stringify(save));
  });

  it('uncompressed CE0 code (compress: false) round-trips too', async () => {
    const save = progressed();
    const code = await encodeSaveCode(save, { compress: false });
    expect(code.startsWith('CE0.')).toBe(true);
    const r = await decodeSaveCode(code);
    expect(r.ok && JSON.stringify(r.save)).toBe(JSON.stringify(save));
  });

  it('falls back to CE0 when CompressionStream is missing', async () => {
    const save = progressed();
    vi.stubGlobal('CompressionStream', undefined);
    const code = await encodeSaveCode(save);
    expect(code.startsWith('CE0.')).toBe(true);
    vi.unstubAllGlobals();
    vi.stubGlobal('window', { localStorage: store });
    const r = await decodeSaveCode(code);
    expect(r.ok && JSON.stringify(r.save)).toBe(JSON.stringify(save));
  });

  it('CE1 without DecompressionStream gives its own message', async () => {
    const code = await encodeSaveCode(progressed());
    vi.stubGlobal('DecompressionStream', undefined);
    expect(await decodeSaveCode(code)).toEqual({ ok: false, error: CODE_ERRORS.noGzip });
  });

  it('ignores whitespace / line breaks / quotes picked up while pasting', async () => {
    const save = progressed();
    const code = await encodeSaveCode(save);
    const messy = `  "${code.slice(0, 40)}\n${code.slice(40, 90)} \r\n\t${code.slice(90)}"  `;
    const r = await decodeSaveCode(messy);
    expect(r.ok && JSON.stringify(r.save)).toBe(JSON.stringify(save));
  });

  it('a large save (many chunks for btoa) still round-trips', async () => {
    const save = progressed();
    (save.state as unknown as Record<string, unknown>)['pad'] = 'x'.repeat(300_000);
    const r = await decodeSaveCode(await encodeSaveCode(save, { compress: false }));
    expect(r.ok && JSON.stringify(r.save).length).toBe(JSON.stringify(save).length);
  });
});

describe('invalid codes are rejected', () => {
  const bad: [string, string | (() => Promise<string>), string][] = [
    ['empty', '   ', CODE_ERRORS.empty],
    ['no prefix', 'hello world', CODE_ERRORS.prefix],
    ['raw JSON', '{"version":1}', CODE_ERRORS.prefix],
    ['bad base64', 'CE1.@@@###', CODE_ERRORS.damaged],
    ['truncated gzip', async () => (await encodeSaveCode(progressed())).slice(0, 60), CODE_ERRORS.damaged],
    ['not JSON', `CE0.${b64url('not json at all')}`, CODE_ERRORS.damaged],
    ['newer code format', 'CE2.abcd', CODE_ERRORS.newer],
    ['wrapper from the future', code0({ v: 99, savedAt: null, data: {} }), CODE_ERRORS.newer],
    ['junk object (migrateSave would make a blank game)', code0({ v: 1, savedAt: null, data: { state: {} } }), CODE_ERRORS.notSave],
    ['state without carriages', code0({ v: 1, savedAt: null, data: { version: 1, savedAt: null, state: { shells: 5, carriages: [], permanent: { tickets: 1, openedLines: [1] } } } }), CODE_ERRORS.notSave],
    ['no data', code0({ v: 1, savedAt: 1 }), CODE_ERRORS.notSave],
  ];
  for (const [name, c, err] of bad) {
    it(name, async () => {
      const code = typeof c === 'string' ? c : await c();
      expect(await decodeSaveCode(code)).toEqual({ ok: false, error: err });
    });
  }

  it('a save from a newer SAVE_VERSION is refused (friendly, no throw)', async () => {
    const save = progressed();
    const r = await decodeSaveCode(code0({ v: 1, savedAt: save.savedAt, data: { ...save, version: SAVE_VERSION + 1 } }));
    expect(r).toEqual({ ok: false, error: CODE_ERRORS.newer });
  });
});

describe('old-version save is migrated', () => {
  it('v0 (Tickets at the top level) → current SaveData', async () => {
    const cur = progressed();
    const st = JSON.parse(JSON.stringify(cur.state)) as Record<string, unknown>;
    const perm = st['permanent'] as Record<string, unknown>;
    delete st['permanent'];
    for (const k of ['tickets', 'totalTicketsEarned', 'upgrades', 'stamps', 'postcards', 'openedLines']) st[k] = perm[k];
    const r = await decodeSaveCode(code0({ v: 1, savedAt: 5, data: { version: 0, savedAt: 5, state: st } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.version).toBe(SAVE_VERSION);
    expect(r.save.state.permanent.tickets).toBe(5);
    expect(r.save.state.permanent.openedLines).toContain(2);
    expect((r.save.state as unknown as Record<string, unknown>)['tickets']).toBeUndefined();
  });
});

describe('import never damages the existing save', () => {
  it('invalid code: stored save is byte-identical afterwards', async () => {
    const existing = JSON.stringify(progressed());
    store.setItem(SAVE_KEY, existing);
    const game = new GameController({ seed: 3 });
    for (const c of ['', 'CE1.zzzz', code0({ v: 1, data: { state: {} } }), 'CE1.' + 'A'.repeat(400)]) {
      const r = await decodeSaveCode(c);
      expect(r.ok).toBe(false);
    }
    expect(game.sim.state.permanent.tickets).toBe(5);
    expect(readSaveRaw()).toBe(existing);
    expect(store.getItem(BACKUP_KEY)).toBeNull();
  });

  it('replaceSave: write failure keeps the old save; success keeps a backup', () => {
    const old = JSON.stringify(progressed());
    store.setItem(SAVE_KEY, old);
    const incoming = progressed();
    incoming.state.permanent.tickets = 42;
    store.failWrites = true;
    expect(replaceSave(incoming)).toBe(false);
    expect(store.getItem(SAVE_KEY)).toBe(old);
    store.failWrites = false;
    expect(replaceSave(incoming)).toBe(true);
    expect(store.getItem(SAVE_KEY)).toBe(JSON.stringify(incoming));
    expect(store.getItem(BACKUP_KEY)).toBe(old);
  });

  it('replaceSave returns false with no storage at all', () => {
    vi.stubGlobal('window', {});
    expect(replaceSave(progressed())).toBe(false);
  });
});

describe('controller import flow', () => {
  const stubLoop = () => {
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('document', { removeEventListener: () => {} });
    vi.stubGlobal('window', { localStorage: store, removeEventListener: () => {} });
  };

  it('export → fresh device → preview → apply restores Tickets / Lines / Shells, and autosave cannot overwrite it', async () => {
    store.setItem(SAVE_KEY, JSON.stringify(progressed()));
    const src = new GameController({ seed: 1 });
    const code = await encodeSaveCode(src.exportSave());

    store = new MemStorage(); // the new home-screen icon: empty storage
    stubLoop();
    const dst = new GameController({ seed: 2 });
    expect(dst.sim.state.permanent.tickets).toBe(0);
    const r = await decodeSaveCode(code);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pv = dst.previewImport(r.save);
    expect(pv.tickets).toBe(5);
    expect(pv.openedLines).toContain(2);
    expect(pv.shells).toBeCloseTo(src.sim.state.shells, 6);
    expect(store.getItem(SAVE_KEY)).toBeNull(); // preview wrote nothing
    expect(dst.applyImport(r.save)).toBe(true);
    const written = store.getItem(SAVE_KEY);
    expect(written).toBe(JSON.stringify(r.save));
    dst.save(); // pagehide / autosave after the import must be a no-op
    expect(store.getItem(SAVE_KEY)).toBe(written);

    const reloaded = new GameController({ seed: 9 });
    expect(reloaded.sim.state.permanent.tickets).toBe(5);
    expect(reloaded.sim.state.permanent.openedLines).toContain(2);
    expect(reloaded.sim.state.shells).toBeGreaterThanOrEqual(src.sim.state.shells - 1e-6);
  });

  it('applyImport failure: old save kept, game keeps saving', async () => {
    const old = JSON.stringify(progressed());
    store.setItem(SAVE_KEY, old);
    stubLoop();
    const game = new GameController({ seed: 4 });
    const r = await decodeSaveCode(await encodeSaveCode(progressed()));
    if (!r.ok) throw new Error('decode');
    store.failWrites = true;
    expect(game.applyImport(r.save)).toBe(false);
    expect(store.getItem(SAVE_KEY)).toBe(old);
    store.failWrites = false;
    game.save();
    expect(store.getItem(SAVE_KEY)).not.toBe(old); // unlocked again
  });
});

describe('saveFileName', () => {
  it('uses the local date', () => {
    expect(saveFileName(new Date(2026, 10, 5, 13, 0))).toBe('coral-express-save-20261105.txt');
  });
});
