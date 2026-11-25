// T-23 ship screenshots: `node tests/e2e/ship.cjs [--url=https://coral-express.vercel.app/] [01 02 ...]`
// 1280×720 @2×, written to docs/qa/ship/. Toasts, tutorial tips and line splashes are hidden.
const path = require('node:path');
const fs = require('node:fs');
const urlArg = process.argv.find((a) => a.startsWith('--url='));
if (urlArg) process.env.E2E_BASE = urlArg.slice(6).replace(/\/?$/, '/');
const L = require('./lib.cjs');

const OUT = path.join(L.ROOT, 'docs/qa/ship');
const HIDE = '.ui-toasts,.ui-tip,.cine-splash{display:none!important}';
const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const on = (id) => !want.length || want.includes(id);

async function page2x(browser) {
  const page = await L.newPage(browser, { width: 1280, height: 720 }, { context: { deviceScaleFactor: 2 } });
  await L.openGame(page, 'new=1&nosave=1');
  await L.passTitle(page);
  await L.clearModals(page);
  await page.addStyleTag({ content: HIDE });
  return page;
}

async function settle(page, ms = 1500) {
  await L.frames(page, 6);
  await page.waitForTimeout(ms);
}

async function snap(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addStyleTag({ content: HIDE });
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p });
  console.log('wrote', p);
  return p;
}

/** Give the current Line three carriages, each filled with its habitat's community (+1 shiny). */
async function fillLine(page) {
  return page.evaluate(() => {
    const d = window.__debug;
    const g = d.game;
    const s = d.sim.state;
    d.addShells(1e30);
    const line = g.data.lines.find((l) => l.id === s.currentLine);
    const habs = line.habitats;
    for (let i = 0; s.carriages.length < 3 && i < 6; i++) d.sim.act({ type: 'buyCarriage', habitat: habs[(s.carriages.length + 1) % habs.length] });
    g.drain(true);
    const comm = g.data.bonds.communities;
    const byHab = (h) => g.data.species.filter((sp) => sp.habitat === h || (h === 'vent' && sp.habitat === 'any'));
    for (const car of s.carriages) {
      const c = comm.find((x) => x.members.every((m) => byHab(car.habitat).some((sp) => sp.id === m)));
      const ids = c ? c.members.slice() : byHab(car.habitat).map((sp) => sp.id);
      for (const sp of byHab(car.habitat)) if (!ids.includes(sp.id)) ids.push(sp.id);
      let k = 0;
      while (car.fish.length < car.slots && k < 12) {
        const sp = ids[k % ids.length];
        d.spawnFish(sp, car.id, { shiny: k === 1, level: 10 });
        k++;
      }
    }
    // a little decor in each car where possible
    // a few decor pieces per car (buy → place on the sand)
    const decs = g.data.decor.filter((x) => d.sim.price({ type: 'buyDecor', decorId: x.id }) !== null);
    s.carriages.forEach((car, ci) => {
      for (let j = 0; j < 2 && decs.length; j++) {
        const dec = decs[(ci * 2 + j) % decs.length];
        if (!d.sim.act({ type: 'buyDecor', decorId: dec.id }).ok) continue;
        d.sim.act({ type: 'placeDecor', carId: car.id, decorId: dec.id, x: j ? 0.75 : 0.25, y: 0.1, layer: 'back', scale: 1, flip: j === 1 });
      }
    });
    g.drain(true);
    return s.carriages.map((c) => ({ id: c.id, hab: c.habitat, fish: c.fish.length, decor: c.decor.length }));
  });
}

/** Ride until the train is parked at a station with time left on the stop. */
async function parkAtStation(page) {
  await page.evaluate(() => {
    const d = window.__debug;
    for (let i = 0; i < 200 && d.sim.state.train.phase !== 'stopped'; i++) d.fastForward(0.5);
  });
}

async function lineShot(page, name, tod) {
  await page.evaluate((t) => window.__debug.setTimeOfDay(t), tod);
  await parkAtStation(page);
  await settle(page, 2500);
  return snap(page, name);
}

(async () => {
  const srv = await L.startServer();
  const browser = await L.loadPlaywright().chromium.launch();
  const page = await page2x(browser);
  const info = {};
  info.l1 = await fillLine(page);
  if (on('01')) await lineShot(page, '01_line1', 'afternoon');
  if (on('04')) {
    const car = await page.evaluate(() => window.__debug.sim.state.carriages[0].id);
    await page.evaluate((id) => window.__debug.game.bus.emit('openPanel', { id: `car:${id}` }), car);
    await settle(page, 2000);
    info.bonds = await page.evaluate(() => (document.querySelector('.ui-bonds') || {}).innerText || '');
    await snap(page, '04_car_detail_community');
    await L.clearModals(page);
    await page.keyboard.press('Escape');
  }
  if (on('05')) {
    await page.evaluate(() => window.__debug.skipTo('depotReset'));
    await page.waitForTimeout(800);
    await L.clearModals(page);
    await page.evaluate(() => {
      const panel = document.querySelector('.ui-panel');
      if (!panel || panel.getAttribute('aria-hidden') === 'true') window.__debug.game.bus.emit('openPanel', { id: 'depot' });
    });
    await settle(page, 1500);
    // pick a Mascot so the picker shows a selection
    await page.evaluate(() => {
      const b = document.querySelector('.ui-panel-body .ui-mascot button, .ui-panel-body [class*=mascot] button');
      if (b) b.click();
    });
    await settle(page, 800);
    info.depot = await page.evaluate(() => (document.querySelector('.ui-panel-body') || {}).innerText || '');
    await snap(page, '05_depot');
    await L.clearModals(page);
    await page.keyboard.press('Escape');
  }
  if (on('02') || on('03') || on('06')) {
    await page.evaluate(() => window.__debug.skipTo('line2'));
    await L.clearModals(page);
    info.l2 = await fillLine(page);
    if (on('02')) await lineShot(page, '02_line2', 'afternoon');
  }
  if (on('03') || on('06')) {
    await page.evaluate(() => window.__debug.skipTo('line3'));
    await L.clearModals(page);
    info.l3 = await fillLine(page);
    if (on('03')) await lineShot(page, '03_line3', 'afternoon');
  }
  if (on('06')) {
    await page.evaluate(() => window.__debug.forceWin());
    await page.waitForSelector('.ending', { timeout: 10000 });
    const beat = process.env.SHIP_BEAT || 'panorama';
    const u = Number(process.env.SHIP_U || 0.6);
    await page.evaluate(({ beat, u }) => window.__debug.ending.seek(beat, u), { beat, u });
    await settle(page, 3000);
    info.endingBeat = await page.evaluate(() => document.querySelector('.ending').dataset.beat);
    await snap(page, '06_ending');
  }
  console.log(JSON.stringify(info, null, 1).slice(0, 3000));
  await browser.close();
  L.stopServer(srv);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
