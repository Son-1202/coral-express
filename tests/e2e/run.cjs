// Coral Express E2E runner (T-21): `npm run build && node tests/e2e/run.cjs [checkName ...]`
// Starts `vite preview` on :4173 (or uses E2E_BASE), runs every check, fails on any console error.
// Writes docs/qa/e2e_results.json.
const fs = require('node:fs');
const path = require('node:path');
// `--url=https://host/` runs against a deployed build instead of vite preview (T-23).
const urlArg = process.argv.find((a) => a.startsWith('--url='));
if (urlArg) process.env.E2E_BASE = urlArg.slice(6).replace(/\/?$/, '/');
const L = require('./lib.cjs');
const C = require('./checks.cjs');
const M = require('./matrix.cjs');

const ALL = {
  smoke: C.smoke,
  session: C.session,
  offline: C.offline,
  saveLoad: C.saveLoad,
  tankView: C.tankView,
  matrix: M.matrix,
  phone: M.phone,
  ending: M.ending,
  motionZoo: M.motionZoo,
  motionTrain: M.motionTrain,
};

(async () => {
  const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const names = want.length ? want : Object.keys(ALL);
  const t0 = Date.now();
  const srv = await L.startServer();
  const browser = await L.loadPlaywright().chromium.launch();
  const results = [];
  for (const n of names) {
    L.setCheck(n);
    const s = Date.now();
    const errBefore = L.ERRORS.length;
    let r;
    try {
      const details = await ALL[n](browser);
      r = { name: n, pass: true, details };
    } catch (e) {
      r = { name: n, pass: false, error: String(e && e.message ? e.message : e), details: e && e.details };
    }
    r.seconds = Math.round((Date.now() - s) / 100) / 10;
    r.consoleErrors = L.ERRORS.slice(errBefore);
    if (r.consoleErrors.length) r.pass = false;
    results.push(r);
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${n} (${r.seconds}s)${r.error ? ' — ' + r.error : ''}${r.consoleErrors.length ? ` — ${r.consoleErrors.length} console error(s)` : ''}`);
  }
  await browser.close();
  L.stopServer(srv);
  const total = Math.round((Date.now() - t0) / 1000);
  const out = { when: new Date().toISOString(), totalSeconds: total, pass: results.every((r) => r.pass), results };
  if (urlArg) {
    out.base = L.BASE;
    fs.writeFileSync(path.join(L.ROOT, 'docs/qa/e2e_results_live.json'), JSON.stringify(out, null, 1));
  } else if (!want.length) fs.writeFileSync(path.join(L.ROOT, 'docs/qa/e2e_results.json'), JSON.stringify(out, null, 1));
  else fs.writeFileSync(path.join(L.ROOT, `docs/qa/e2e_results_partial.json`), JSON.stringify(out, null, 1));
  console.log(`${out.pass ? 'ALL PASS' : 'FAILURES'} in ${total}s`);
  process.exit(out.pass ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
