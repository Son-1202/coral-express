// Ad-hoc probe (dev aid): node tests/e2e/probe.cjs "<js to eval after title>"
const L = require('./lib.cjs');
(async () => {
  const srv = await L.startServer();
  const browser = await L.loadPlaywright().chromium.launch();
  const page = await L.newPage(browser);
  const t0 = Date.now();
  await L.openGame(page, 'new=1');
  console.log('debug ready', Date.now() - t0, 'ms');
  await L.frames(page, 5);
  await L.shot(page, 'probe_title');
  await L.passTitle(page);
  await L.frames(page, 5);
  if (process.argv[2]) console.log(JSON.stringify(await page.evaluate(process.argv[2]), null, 1));
  await L.shot(page, 'probe_after');
  console.log(JSON.stringify(await L.state(page)));
  console.log(await page.evaluate(() => document.querySelector('.ui-root').innerHTML.slice(0, 1500)));
  console.log('errors', JSON.stringify(L.ERRORS, null, 1));
  await browser.close();
  L.stopServer(srv);
})();
