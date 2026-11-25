// E2E checks (T-21). Each check: async (browser) => details object; throws on failure.
const L = require('./lib.cjs');
const { assert, state } = L;

const TODS = ['morning', 'afternoon', 'dusk', 'night'];
const SIGHTS = ['dolphin_race', 'seagull_thief', 'whale_breach', 'festival_station', 'stowaway', 'sea_fog'];

/** Fresh game, title passed, modals cleared. */
async function freshGame(browser, viewport, query = 'new=1') {
  const page = await L.newPage(browser, viewport);
  await L.openGame(page, query);
  await L.passTitle(page);
  await L.clearModals(page);
  return page;
}

/** Dismiss the tutorial tip (it never blocks, but it covers screenshots). */
async function hideTip(page) {
  await page.evaluate(() => document.querySelectorAll('.ui-tip').forEach((e) => (e.style.display = 'none')));
}

async function panelTitle(page) {
  return page.evaluate(() => {
    const p = document.querySelector('.ui-panel');
    return p && p.getAttribute('aria-hidden') !== 'true' ? (p.querySelector('.ui-panel-title') || {}).textContent || '(untitled)' : null;
  });
}

async function key(page, k, wait = 400) {
  await page.keyboard.press(k);
  await page.waitForTimeout(wait);
}

// ---------------------------------------------------------------- 1. smoke
async function smoke(browser) {
  const page = await L.newPage(browser);
  await L.openGame(page, 'new=1');
  await page.waitForSelector('.ui-title-menu button', { timeout: 15000 });
  await L.frames(page, 4);
  const btns = await page.$$eval('.ui-title-menu button', (b) => b.map((x) => x.innerText.trim()));
  await L.shot(page, 'title');
  assert(btns.some((t) => /new game/i.test(t)), `title has New Game (${btns})`);
  assert(btns.some((t) => /settings/i.test(t)), 'title has Settings');
  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas.stage'));
  assert(hasCanvas, 'stage canvas');
  await L.closePage(page);
  return { buttons: btns };
}

// ---------------------------------------------------------------- 2. full session
async function session(browser) {
  const out = {};
  try {
    return await sessionInner(browser, out);
  } catch (e) {
    e.details = out;
    throw e;
  }
}

async function sessionInner(browser, out) {
  const page = await freshGame(browser);
  // buy first fish through the real Market UI
  await key(page, 'm');
  assert((await panelTitle(page)) !== null, 'market opens with M');
  const bought = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.ui-panel-body .ui-list .ui-item-side button')].find((x) => !x.disabled && !x.classList.contains('off'));
    if (!b) return false;
    b.click();
    return b.innerText.replace(/\s+/g, ' ').slice(0, 60);
  });
  await page.waitForTimeout(500);
  let s = await state(page);
  out.firstBuy = { button: bought, fish: s.fish, shells: s.shells };
  assert(s.fish >= 1, `first fish bought via Market UI (button: ${bought})`);
  await key(page, 'Escape');
  // feed (Space feeds best car)
  const before = await page.evaluate(() => JSON.stringify(window.__debug.sim.carInfo(window.__debug.sim.state.carriages[0].id)));
  await key(page, ' ', 600);
  const after = await page.evaluate(() => JSON.stringify(window.__debug.sim.carInfo(window.__debug.sim.state.carriages[0].id)));
  out.feedChanged = before !== after;
  assert(before !== after, 'Space feeds a carriage (carInfo changed)');
  // panels M/T/S/D
  out.panels = {};
  for (const k of ['m', 't', 's', 'd']) {
    await key(page, k);
    out.panels[k] = await panelTitle(page);
    assert(out.panels[k], `panel ${k} opens`);
    await key(page, k); // toggles closed
  }
  assert((await panelTitle(page)) === null, 'panel toggles closed');
  // depot reset with mascot
  await page.evaluate(() => window.__debug.skipTo('depotReset'));
  await page.waitForTimeout(600);
  await L.clearModals(page);
  await page.evaluate(() => window.__debug.api && document.querySelector('.ui-panel[aria-hidden="true"]') && window.__debug.game.bus.emit('openPanel', { id: 'depot' }));
  await page.waitForTimeout(500);
  const t0 = (await state(page)).tickets;
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.ui-panel-body button')].find((x) => /Depot Reset/i.test(x.innerText));
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  // confirm dialog
  await page.evaluate(() => {
    const d = document.querySelector('.ui-modal:last-child');
    const b = d && [...d.querySelectorAll('button')].find((x) => /reset|depot|yes|go|ok/i.test(x.innerText) && !/cancel/i.test(x.innerText));
    if (b) b.click();
  });
  await page.waitForTimeout(1200);
  s = await state(page);
  out.reset = { ticketsBefore: t0, tickets: s.tickets, mascot: s.mascot, line: s.line };
  assert(s.mascot, 'Mascot set after Depot Reset via UI');
  // skipTo('depotReset') only lifts runShells to minRunShells, which can project 0 Tickets (bug logged in QA_REPORT)
  if (s.tickets <= t0) out.warnings = ['Depot Reset granted 0 Tickets after skipTo(depotReset)'];
  await L.clearModals(page);
  await key(page, 'Escape');
  // lines
  out.line2 = await page.evaluate(() => window.__debug.skipTo('line2'));
  assert(out.line2.line === 2, 'skipTo line2');
  out.line3 = await page.evaluate(() => window.__debug.skipTo('line3'));
  assert(out.line3.line === 3, 'skipTo line3');
  await L.clearModals(page);
  await page.evaluate(() => window.__debug.forceWin());
  s = await state(page);
  out.afterWin = s;
  // ending overlay
  const ending = await page.waitForSelector('.ending', { timeout: 8000 }).then(() => true).catch(() => false);
  out.endingShown = ending;
  if (ending) {
    await page.waitForTimeout(3500);
    await page.evaluate(() => document.querySelector('.ending-skip') && document.querySelector('.ending-skip').click());
    const gone = await page.waitForSelector('.ending', { state: 'detached', timeout: 8000 }).then(() => true).catch(() => false);
    out.endingSkipped = gone;
  }
  s = await state(page);
  out.endless = s.endless;
  assert(s.endless, 'endless mode flag after Grand Terminus');
  await L.closePage(page);
  if (!ending) throw Object.assign(new Error('ending overlay never appeared after forceWin() (ending not wired into the game)'), { details: out });
  return out;
}

// ---------------------------------------------------------------- 3. offline
async function offline(browser) {
  const page = await freshGame(browser);
  await page.evaluate(() => window.__debug.spawnFish('pebble_damsel'));
  await page.evaluate(() => window.__debug.game.save());
  await page.evaluate(() => {
    const k = 'coral-express.save';
    const j = JSON.parse(localStorage.getItem(k));
    j.savedAt -= 3600 * 1000;
    localStorage.setItem(k, JSON.stringify(j));
    window.__debug.game.stop();
    // block the pagehide autosave so the back-dated save survives the reload
    Storage.prototype.setItem = function () {};
  });
  await page.goto(L.BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.__debug && window.__debug.sim), null, { timeout: 30000 });
  await page.waitForSelector('.ui-title-menu', { timeout: 10000 });
  const titleTxt = await page.$eval('.ui-title-menu', (e) => e.innerText.replace(/\s+/g, ' '));
  await L.passTitle(page);
  const pop = await page.waitForSelector('.ui-offline', { timeout: 6000 }).then(() => true).catch(() => false);
  await L.frames(page, 3);
  await hideTip(page);
  await L.shot(page, 'offline_popup');
  const txt = pop ? await page.$eval('.ui-offline', (e) => e.innerText.replace(/\s+/g, ' ')) : '';
  await L.closePage(page);
  assert(/away/i.test(titleTxt), `title Continue shows time away (${titleTxt})`);
  assert(pop, 'offline postcard shown');
  assert(/Time away/i.test(txt) && /Shells/i.test(txt), 'postcard lists time away + Shells');
  return { titleTxt, popup: txt };
}

// ---------------------------------------------------------------- 4. save/load
async function saveLoad(browser) {
  const page = await freshGame(browser);
  await page.evaluate(() => {
    window.__debug.addShells(12345);
    window.__debug.spawnFish('pebble_damsel');
    window.__debug.spawnFish('clownfish');
    window.__debug.game.save();
  });
  const a = await state(page);
  await page.goto(L.BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.__debug && window.__debug.sim), null, { timeout: 30000 });
  const b = await state(page);
  assert(b.fish === a.fish, `fish kept after reload (${a.fish} → ${b.fish})`);
  assert(b.shells >= a.shells * 0.99, `shells kept after reload (${a.shells} → ${b.shells})`);
  // corrupted save
  await page.evaluate(() => {
    window.__debug.game.stop();
    localStorage.setItem('coral-express.save', '{"version":1,"state":{"shells":"banana","fish":7}');
    Storage.prototype.setItem = function () {};
  });
  await page.goto(L.BASE, { waitUntil: 'load' });
  const ok = await page.waitForFunction(() => !!(window.__debug && window.__debug.sim), null, { timeout: 30000 }).then(() => true).catch(() => false);
  const c = ok ? await state(page) : null;
  await L.closePage(page);
  assert(ok, 'game boots with corrupted save');
  assert(c.fish === 0 && Number.isFinite(c.shells), `fresh game after corrupted save (${JSON.stringify(c)})`);
  return { before: a, reloaded: b, corrupted: c };
}

// ---------------------------------------------------------------- 5. tank view
async function tankView(browser) {
  const out = {};
  const page = await freshGame(browser);
  await page.evaluate(() => {
    const d = window.__debug;
    ['pebble_damsel', 'clownfish', 'carpet_anemone'].forEach((s) => d.spawnFish(s));
    const dec = d.game.data.decor.find((x) => d.sim.price({ type: 'buyDecor', decorId: x.id }) !== null);
    if (dec) {
      d.addShells(1e6);
      d.sim.act({ type: 'buyDecor', decorId: dec.id });
    }
    d.game.drain();
  });
  await hideTip(page);
  await key(page, 'Enter', 2500);
  out.active = await page.evaluate(() => window.__debug.tank && window.__debug.tank.isActive());
  assert(out.active, 'Enter opens Tank View');
  await L.frames(page, 4);
  await L.shot(page, 'tank_watch');
  await key(page, 'e', 800);
  await L.frames(page, 3);
  const item = await page.$('.tk-tray .tk-item:not(.nofit)');
  const decorBefore = await page.evaluate(() => window.__debug.sim.state.carriages[0].decor.length);
  if (item) {
    const r = await item.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(r.x + (640 - r.x) * (i / 8), r.y + (380 - r.y) * (i / 8));
    await page.mouse.up();
    await page.waitForTimeout(600);
  }
  out.decorPlaced = (await page.evaluate(() => window.__debug.sim.state.carriages[0].decor.length)) - decorBefore;
  await L.frames(page, 3);
  await L.shot(page, 'tank_decorate');
  await key(page, 'p', 800);
  await L.frames(page, 3);
  out.photo = await page.evaluate(() => !!document.querySelector('.tank-root.photo'));
  await L.shot(page, 'tank_photo');
  const tEsc = Date.now();
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__debug.tank.isActive())); i++) await key(page, 'Escape', 600);
  out.exited = await page.waitForFunction(() => !window.__debug.tank.isActive(), null, { timeout: 10000 }).then(() => true).catch(() => false);
  out.escMs = Date.now() - tEsc;
  await L.closePage(page);
  assert(item, 'decor tray has an item');
  assert(out.decorPlaced === 1, `drag from tray places decor (${out.decorPlaced})`);
  assert(out.photo, 'P enters photo mode');
  assert(out.exited, 'Esc leaves Tank View');
  return out;
}

module.exports = { smoke, session, offline, saveLoad, tankView, freshGame, hideTip, key, panelTitle, TODS, SIGHTS };
