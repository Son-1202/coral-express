// Screenshot matrix + motion checks (T-21).
const { spawn } = require('node:child_process');
const path = require('node:path');
const L = require('./lib.cjs');
const C = require('./checks.cjs');
const { assert } = L;

let sharp = null;
try {
  sharp = require(path.join(L.ROOT, 'node_modules/sharp'));
} catch {
  /* diff falls back to a skipped result */
}

async function settle(page, n = 4) {
  await L.frames(page, n);
  await page.waitForTimeout(300);
}

async function populate(page) {
  await page.evaluate(() => {
    const d = window.__debug;
    d.addShells(1e7);
    for (const h of ['reef', 'kelp']) d.sim.act({ type: 'buyCarriage', habitat: h });
    d.game.drain();
    const cars = d.sim.state.carriages;
    ['pebble_damsel', 'carpet_anemone', 'clownfish'].forEach((s) => d.spawnFish(s, cars[0].id));
    ['garibaldi', 'kelp_seahorse', 'leafy_seadragon'].forEach((s) => d.spawnFish(s, cars[cars.length - 1].id));
    ['pebble_damsel', 'clownfish'].forEach((s) => d.spawnFish(s, cars[1] && cars[1].id, { shiny: true }));
  });
}

async function openPanel(page, id) {
  await page.evaluate((id) => window.__debug.game.bus.emit('openPanel', { id }), id);
  await page.waitForTimeout(500);
}

async function closeAll(page) {
  await L.clearModals(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------- matrix (desktop)
async function matrix(browser) {
  const out = { shots: [] };
  const page = await C.freshGame(browser, { width: 1280, height: 720 }, 'new=1&nosave=1');
  await populate(page);
  await C.hideTip(page);
  const snap = async (name) => {
    await C.hideTip(page);
    await settle(page);
    out.shots.push(await L.shot(page, name));
  };
  // panels on line 1
  const tabs = ['fish', 'decor', 'special', 'requests', 'catalogue'];
  for (let i = 0; i < tabs.length; i++) {
    await openPanel(page, `market:${tabs[i]}`);
    await page.evaluate((i) => {
      const t = document.querySelectorAll('.ui-tabs .ui-tab')[i];
      if (t) t.click();
    }, i);
    await snap(`market_${tabs[i]}`);
  }
  await closeAll(page);
  const car0 = await page.evaluate(() => window.__debug.sim.state.carriages[0].id);
  await openPanel(page, `car:${car0}`);
  const bonds = await page.evaluate(() => (document.querySelector('.ui-bonds') || {}).innerText || '');
  out.carDetailBonds = bonds.replace(/\s+/g, ' ').slice(0, 200);
  await snap('car_detail_community');
  await closeAll(page);
  for (const p of ['track', 'stamps', 'depot']) {
    await openPanel(page, p);
    await snap(`panel_${p}`);
    await closeAll(page);
  }
  await page.click('.ui-cog');
  await page.waitForTimeout(500);
  await snap('panel_settings');
  await closeAll(page);
  // sights (line 1, afternoon)
  for (const id of C.SIGHTS) {
    const ok = await page.evaluate((id) => window.__debug.triggerSight(id), id);
    await page.waitForTimeout(1200);
    await snap(`sight_${id}`);
    out[`sight_${id}`] = ok;
    await page.evaluate(() => window.__debug.fastForward(40));
    await L.clearModals(page);
  }
  // line × time of day
  for (const line of [1, 2, 3]) {
    if (line > 1) {
      await page.evaluate((l) => window.__debug.skipTo(`line${l}`), line);
      await L.clearModals(page);
      await populate(page);
    }
    for (const t of C.TODS) {
      await page.evaluate((t) => window.__debug.setTimeOfDay(t), t);
      await snap(`train_l${line}_${t}`);
    }
    await page.evaluate(() => window.__debug.setTimeOfDay(null));
  }
  await L.closePage(page);
  return { count: out.shots.length, carDetailBonds: out.carDetailBonds };
}

// ---------------------------------------------------------------- phone + portrait
async function phone(browser) {
  const page = await C.freshGame(browser, { width: 844, height: 390 }, 'new=1&nosave=1');
  await populate(page);
  await C.hideTip(page);
  await settle(page);
  await L.shot(page, 'phone_train');
  await openPanel(page, 'market:fish');
  await settle(page);
  await L.shot(page, 'phone_market');
  const panelW = await page.evaluate(() => document.querySelector('.ui-panel').getBoundingClientRect().width);
  // HUD buttons must be ≥ 44 px touch targets
  const small = await page.$$eval('.hud-btn, .ui-cog, .ui-close', (b) => b.map((x) => x.getBoundingClientRect()).filter((r) => r.width > 0 && (r.width < 44 || r.height < 44)).length);
  await L.closePage(page);
  const port = await L.newPage(browser, { width: 390, height: 844 });
  await L.openGame(port, 'new=1&nosave=1');
  await L.passTitle(port);
  await settle(port);
  const card = await port.evaluate(() => {
    const e = [...document.querySelectorAll('[class*=rotate]')].find((x) => getComputedStyle(x).display !== 'none' && x.getBoundingClientRect().width > 0);
    return e ? e.className : null;
  });
  await L.shot(port, 'portrait_rotate');
  await L.closePage(port);
  assert(card, 'portrait shows rotate card');
  return { panelWidthPct: Math.round((panelW / 844) * 100), smallTouchTargets: small, rotateCard: card };
}

// ---------------------------------------------------------------- ending (dev preview page, beats)
async function ending(browser) {
  const port = 5179;
  const srv = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: L.ROOT, stdio: 'ignore', detached: true });
  const base = `http://localhost:${port}/src/ui/ending/preview.html`;
  const out = {};
  try {
    const end = Date.now() + 30000;
    for (;;) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {
        /* not up */
      }
      if (Date.now() > end) throw new Error('dev server not up');
      await new Promise((r) => setTimeout(r, 300));
    }
    for (const [beat, u] of [['beach', 0.5], ['postcard', 0.6], ['panorama', 0.6], ['theEnd', 0.5], ['credits', 0.4]]) {
      const page = await L.newPage(browser);
      await page.goto(`${base}?auto=1&n=18&beat=${beat}&u=${u}`, { waitUntil: 'load' });
      await page.waitForSelector('.ending', { timeout: 20000 });
      await page.waitForTimeout(1500);
      await settle(page);
      out[beat] = await page.evaluate(() => document.querySelector('.ending').dataset.beat);
      await L.shot(page, `ending_${beat}`);
      await L.closePage(page);
    }
  } finally {
    try {
      process.kill(-srv.pid, 'SIGTERM');
    } catch {
      srv.kill();
    }
  }
  return out;
}

// ---------------------------------------------------------------- motion
async function diffCells(a, b, cells, w) {
  const [ra, rb] = await Promise.all([sharp(a).raw().toBuffer({ resolveWithObject: true }), sharp(b).raw().toBuffer({ resolveWithObject: true })]);
  const ch = ra.info.channels;
  return cells.map((c) => {
    let n = 0;
    let tot = 0;
    for (let y = Math.floor(c.y); y < c.y + c.h; y += 1)
      for (let x = Math.floor(c.x); x < c.x + c.w; x += 1) {
        const i = (y * w + x) * ch;
        const d = Math.abs(ra.data[i] - rb.data[i]) + Math.abs(ra.data[i + 1] - rb.data[i + 1]) + Math.abs(ra.data[i + 2] - rb.data[i + 2]);
        if (d > 24) n++;
        tot++;
      }
    return n / Math.max(1, tot);
  });
}

async function motionZoo(browser) {
  const page = await L.newPage(browser);
  await page.goto(L.BASE + '?debug=zoo', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const shots = [];
  for (const [i, tag] of [[0, '0'], [500, '05'], [500, '1'], [1000, '2']]) {
    if (i) await page.waitForTimeout(i);
    shots.push(await L.shot(page, `zoo_t${tag}`));
  }
  const rect = await page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  await L.closePage(page);
  if (!sharp) return { skipped: 'sharp missing' };
  // zoo world is 80×50 units (src/render/tank/zoo.ts): 6 cols × 8 u species rows, plants y 9.1–17.7, sights y 0–8.4
  const W = 80;
  const H = 50;
  const toPx = (x, y, w, h) => ({ x: rect.x + (x / W) * rect.w, y: rect.y + ((H - y - h) / H) * rect.h, w: (w / W) * rect.w, h: (h / H) * rect.h });
  const cells = [];
  for (let i = 0; i < 19; i++) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    cells.push({ id: `species${i}`, ...toPx(col * (W / 6) + 0.3, H - (row + 1) * 8 - 0.6 + 1, W / 6 - 0.6, 6.4) });
  }
  for (let i = 0; i < 20; i++) cells.push({ id: `plant${i}`, ...toPx(Math.floor(i / 4) * 16 + (i % 4) * 4, 9.4, 4, 7.6) });
  for (let i = 0; i < 6; i++) cells.push({ id: `sight${i}`, ...toPx(i * (W / 6), 0.2, W / 6, 7.6) });
  const d1 = await diffCells(shots[0], shots[2], cells, 1280);
  const d2 = await diffCells(shots[0], shots[1], cells, 1280);
  // plants with sway amp 0 (e.g. vent_3 mineral spire) are static by design
  const plants = require(path.join(L.ROOT, 'src/data/plants.json'));
  const HAB = ['reef', 'mangrove', 'kelp', 'polar', 'vent'];
  const staticOk = new Set(plants.filter((p) => p.sway && p.sway.amp === 0).map((p) => `plant${HAB.indexOf(p.habitat) * 4 + Number(p.id.split('_')[1]) - 1}`));
  // crawlers rest between hops, so a cell only counts as still if nothing changed over 2 s
  const d3 = await diffCells(shots[0], shots[3], cells, 1280);
  const still = cells.filter((c, i) => d1[i] < 0.002 && d2[i] < 0.002 && d3[i] < 0.002 && !staticOk.has(c.id)).map((c) => c.id);
  const stillAt1s = cells.filter((c, i) => d1[i] < 0.002 && d2[i] < 0.002 && !staticOk.has(c.id)).map((c) => c.id);
  assert(still.length === 0, `zoo cells with no motion over 1 s: ${still.join(', ')}`);
  return { cells: cells.length, still, stillAt1s };
}

async function motionTrain(browser) {
  const page = await C.freshGame(browser, { width: 1280, height: 720 }, 'new=1&nosave=1');
  await populate(page);
  const res = {};
  for (const line of [1, 2, 3]) {
    if (line > 1) {
      await page.evaluate((l) => window.__debug.skipTo(`line${l}`), line);
      await L.clearModals(page);
      await populate(page);
    }
    // make sure the train is mid-leg (moving), not stopped at a station
    await page.evaluate(() => {
      const d = window.__debug;
      for (let i = 0; i < 40 && d.sim.state.train.phase === 'stopped'; i++) d.fastForward(2);
      d.fastForward(4);
    });
    await C.hideTip(page);
    await settle(page);
    const s = [];
    for (let k = 0; k < 3; k++) {
      s.push(await L.shot(page, `train_l${line}_seq${k}`));
      await page.waitForTimeout(700);
    }
    res[`line${line}`] = { phase: await page.evaluate(() => window.__debug.sim.state.train.phase) };
    if (sharp) {
      const d = await diffCells(s[0], s[2], [{ x: 0, y: 120, w: 1280, h: 480 }], 1280);
      res[`line${line}`].changed = Math.round(d[0] * 1000) / 10 + '%';
    }
  }
  await L.closePage(page);
  for (const k of Object.keys(res)) assert(parseFloat(res[k].changed) > 1, `train view ${k} shows motion (${res[k].changed})`);
  return res;
}

module.exports = { matrix, phone, ending, motionZoo, motionTrain };
