// Shared helpers for the Coral Express E2E suite (T-21). Plain Node + global Playwright.
const { spawn, execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return require(path.join(root, 'playwright'));
  }
}

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = path.join(ROOT, 'docs/qa/screens');
const PORT = Number(process.env.E2E_PORT || 4173);
const BASE = process.env.E2E_BASE || `http://localhost:${PORT}/`;

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server not reachable: ${url}`);
}

/** Start `vite preview` on dist/ unless E2E_BASE is given or a server already answers. */
async function startServer() {
  if (process.env.E2E_BASE) return null;
  try {
    const r = await fetch(BASE);
    if (r.ok) return null;
  } catch {
    /* start one */
  }
  const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
  await waitFor(BASE, 30000);
  return srv;
}

function stopServer(srv) {
  if (!srv) return;
  try {
    process.kill(-srv.pid, 'SIGTERM');
  } catch {
    srv.kill('SIGTERM');
  }
}

/** Console errors / page errors / failed requests, collected across the whole suite. */
const ERRORS = [];
const IGNORE = [/favicon/i];
let currentCheck = '';
function setCheck(name) {
  currentCheck = name;
}

async function newPage(browser, viewport = { width: 1280, height: 720 }, opts = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(opts.context || {}) });
  if (opts.init) await context.addInitScript(opts.init.fn, opts.init.arg);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (IGNORE.some((r) => r.test(t))) return;
    ERRORS.push({ where: currentCheck, kind: 'console', text: t.slice(0, 400) });
  });
  page.on('pageerror', (e) => ERRORS.push({ where: currentCheck, kind: 'pageerror', text: String(e && e.stack ? e.stack : e).slice(0, 600) }));
  page.on('requestfailed', (r) => {
    const u = r.url();
    const f = r.failure() && r.failure().errorText;
    if (/\.(mp4|webm|ogg|mp3|m4a)$/.test(u) && /ABORTED/.test(f || '')) return; // media range aborts are normal
    ERRORS.push({ where: currentCheck, kind: 'requestfailed', text: `${u} ${f}` });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) ERRORS.push({ where: currentCheck, kind: 'http', text: `${r.status()} ${r.url()}` });
  });
  page.ctx = context;
  return page;
}

async function closePage(page) {
  await page.ctx.close();
}

/** Open the game and wait until window.__debug is available. */
async function openGame(page, query = '', { waitDebug = true } = {}) {
  await page.goto(BASE + (query ? `?${query}` : ''), { waitUntil: 'load' });
  if (waitDebug) await page.waitForFunction(() => !!(window.__debug && window.__debug.sim), null, { timeout: 30000 });
}

/** Wait for N animation frames (swiftshader renders at a few FPS). */
async function frames(page, n = 3, timeout = 30000) {
  await page.evaluate(
    ({ n, timeout }) =>
      new Promise((res) => {
        let k = 0;
        const t = setTimeout(res, timeout);
        const tick = () => {
          if (++k >= n) {
            clearTimeout(t);
            res();
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { n, timeout },
  );
}

async function shot(page, name, extra = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const p = path.join(SHOTS, `QA_${name}.png`);
  await page.screenshot({ path: p, ...extra });
  return p;
}

/** Click Continue (or New Game) on the title so the sim unpauses. */
async function passTitle(page) {
  if (!(await page.$('.ui-title'))) return;
  const btns = await page.$$('.ui-title-menu button');
  let pick = null;
  for (const b of btns) {
    const t = (await b.innerText()).toLowerCase();
    if (t.includes('continue')) pick = b;
    else if (!pick && t.includes('new game')) pick = b;
  }
  if (pick) await pick.click();
  await page.waitForSelector('.ui-title', { state: 'detached', timeout: 5000 }).catch(() => {});
}

/** Close any modal (postcards, offline popup, tutorial) by pressing Escape a few times. */
async function clearModals(page) {
  for (let i = 0; i < 4; i++) {
    const open = await page.evaluate(() => !!document.querySelector('.ui-modal-layer .ui-modal, .ui-modal-layer > *'));
    if (!open) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`assert: ${msg}`);
}

/** Read a compact snapshot of sim state. */
async function state(page) {
  return page.evaluate(() => {
    const s = window.__debug.sim.state;
    return {
      shells: s.shells,
      runShells: s.runShells,
      line: s.currentLine,
      builtTo: s.builtTo,
      fish: Object.keys(s.fish).length,
      cars: s.carriages.length,
      tickets: s.permanent.tickets,
      openedLines: s.permanent.openedLines.slice(),
      endless: s.permanent.endless,
      mascot: s.permanent.mascot,
      terminal: s.terminalReachedThisRun,
      arrivals: s.lifetime && s.lifetime.arrivals,
      fishBought: s.lifetime && s.lifetime.fishBought,
    };
  });
}

module.exports = { loadPlaywright, startServer, stopServer, newPage, closePage, openGame, frames, shot, passTitle, clearModals, assert, state, setCheck, ERRORS, BASE, ROOT, SHOTS };
