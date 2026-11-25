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

/** Give the current Line three habitat carriages (plus the heritage car), each full of its habitat's fish. */
async function fillLine(page, nCars = 3) {
  // nCars counts every carriage (3 + loco is what the train camera frames fully)
  return page.evaluate((nCars) => {
    const d = window.__debug;
    const g = d.game;
    const s = d.sim.state;
    const shellsShown = { 1: 4.26e5, 2: 3.81e10, 3: 2.64e14 }[s.currentLine];
    d.addShells(1e30);
    const line = g.data.lines.find((l) => l.id === s.currentLine);
    const habs = line.habitats;
    const own = () => s.carriages;
    // cars from an earlier Line switch to this Line's habitats; their old fish go (the Mascot stays)
    own().forEach((car, i) => {
      const want = habs[i % habs.length];
      if (car.habitat !== want) d.sim.act({ type: 'changeHabitat', carId: car.id, habitat: want });
      for (const fid of car.fish.slice()) if (!s.fish[fid].mascot) {
        delete s.fish[fid];
        car.fish.splice(car.fish.indexOf(fid), 1);
      }
    });
    for (let i = 0; own().length < nCars && i < 8; i++) d.sim.act({ type: 'buyCarriage', habitat: habs[own().length % habs.length] });
    for (const car of own()) for (let i = 0; car.slots < 4 && i < 4; i++) d.sim.act({ type: 'buySlot', carId: car.id });
    g.drain(true);
    const comm = g.data.bonds.communities;
    const byHab = (h) => g.data.species.filter((sp) => sp.habitat === h || (h === 'vent' && sp.habitat === 'any'));
    s.carriages.forEach((car, ci) => {
      const pool = byHab(car.habitat).map((sp) => sp.id);
      const c = comm.find((x) => x.members.every((m) => pool.includes(m)));
      // rotate the pool per car so cars of the same habitat look different; community first in car 0/1
      const rot = pool.slice(ci % pool.length).concat(pool.slice(0, ci % pool.length));
      const ids = (c && ci < 2 ? c.members : []).concat(rot.filter((x) => !(c && ci < 2 && c.members.includes(x))));
      let k = 0;
      while (car.fish.length < car.slots && k < 12) {
        d.spawnFish(ids[k % ids.length], car.id, { shiny: k === 1 && ci === 1, level: 10 });
        k++;
      }
    });
    // a couple of decor pieces per car (buy → place on the sand); smallest first
    const decs = g.data.decor.filter((x) => d.sim.price({ type: 'buyDecor', decorId: x.id }) !== null).sort((x, y) => x.capacity - y.capacity);
    const why = [];
    s.carriages.forEach((car, ci) => {
      let placed = 0;
      for (let j = 0; j < decs.length && placed < 2; j++) {
        const dec = decs[(ci + j) % decs.length];
        const b = d.sim.act({ type: 'buyDecor', decorId: dec.id });
        const r = d.sim.act({ type: 'placeDecor', carId: car.id, decorId: dec.id, x: placed ? 0.82 : 0.18, y: 0.05, layer: 'back', scale: 1, flip: placed === 1 });
        if (r.ok) placed++;
        else why.push(`${dec.id}:${b.ok ? '' : b.reason || 'buy'}/${r.reason}`);
      }
    });
    window.__shipWhy = why.slice(0, 6);
    g.drain(true);
    s.shells = shellsShown;
    return { why: window.__shipWhy, cars: s.carriages.map((c) => `${c.id}${c.heritage ? '*' : ''} ${c.habitat} fish=${c.fish.map((f) => s.fish[f].species).join(',')} decor=${c.decor.length}`) };
  }, nCars);
}

/** No Sight on screen (festival bunting etc. would cover the cars). */
async function noSight(page) {
  await page.evaluate(() => {
    const d = window.__debug;
    for (let i = 0; i < 120 && d.sim.state.sight.active; i++) d.fastForward(1);
    d.sim.state.sight.nextAt = d.sim.state.time + 1e6;
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
  await noSight(page);
  await parkAtStation(page);
  // frame the whole train: follow the car next to the loco instead of the loco itself
  await page.evaluate((k) => {
    const st = window.__debug.stage;
    st.selectedCarId = st.train.cars[k] ? st.train.cars[k].id : null;
  }, Number(process.env.SHIP_FOLLOW || 0));
  await settle(page, 2500);
  const p = await snap(page, name);
  await page.evaluate(() => (window.__debug.stage.selectedCarId = null));
  return p;
}

(async () => {
  const srv = await L.startServer();
  const browser = await L.loadPlaywright().chromium.launch();
  const page = await page2x(browser);
  const info = {};
  info.l1 = await fillLine(page);
  if (on('01')) await lineShot(page, '01_line1', 'afternoon');
  if (on('04')) {
    const car = await page.evaluate(() => window.__debug.sim.state.carriages.find((c) => !c.heritage).id);
    await page.evaluate((id) => window.__debug.game.bus.emit('openPanel', { id: `car:${id}` }), car);
    await settle(page, 2000);
    info.bonds = await page.evaluate(() => {
      const b = document.querySelector('.ui-bonds');
      if (b) b.scrollIntoView({ block: 'center' });
      return (b || {}).innerText || '';
    });
    await page.waitForTimeout(400);
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
    const beat = process.env.SHIP_BEAT || 'postcard';
    const u = Number(process.env.SHIP_U || 0.6);
    await page.evaluate(({ beat, u }) => window.__debug.ending.seek(beat, u), { beat, u });
    await L.frames(page, 4);
    await page.waitForTimeout(800);
    info.endingBeat = await page.evaluate(() => document.querySelector('.ending').dataset.beat);
    await snap(page, process.env.SHIP_NAME || '06_ending');
  }
  console.log(JSON.stringify(info, null, 1).slice(0, 3000));
  await browser.close();
  L.stopServer(srv);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
