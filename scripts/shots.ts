/**
 * Screenshot harness: `npm run shots [-- <url>] [-- --query "fast=1&warp=20"] [-- --name T-01]`
 * Without a URL it starts `vite preview` on the built `dist/` (run `npm run build` first).
 * Flags: --eval "<js>" (run after load), --only <viewport-prefix>, --wait <ms>, --fps.
 * Saves docs/qa/screens/<name>_<viewport>.png at deviceScaleFactor 1 and fails on console errors.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Playwright is installed globally in this environment (see CLAUDE.md).
interface PwPage {
  on(ev: 'console', fn: (m: { type(): string; text(): string }) => void): void;
  on(ev: 'pageerror', fn: (e: Error) => void): void;
  goto(url: string, o: { waitUntil: 'load' }): Promise<unknown>;
  evaluate(js: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(o: { path: string }): Promise<unknown>;
  close(): Promise<void>;
}
interface PwBrowser {
  newPage(o: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PwPage>;
  close(): Promise<void>;
}
interface Pw {
  chromium: { launch(o?: { args?: string[] }): Promise<PwBrowser> };
}
function loadPlaywright(): Pw {
  try {
    return require('playwright');
  } catch {
    return require('/opt/node22/lib/node_modules/playwright');
  }
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
const name = flag('name') ?? 'T-01';
const query = flag('query') ?? 'quality=high';
const waitMs = Number(flag('wait') ?? 3000);
/** JS evaluated in the page after load (e.g. "__debug.triggerSight('whale_breach')"). */
const evalJs = flag('eval');
/** Only viewports whose id starts with this (e.g. desktop). */
const only = flag('only');
/** Print window.__debug.stage.guard.fps after the wait. */
const fps = args.includes('--fps');

const VIEWPORTS = [
  { id: 'desktop_1280x720', width: 1280, height: 720 },
  { id: 'phone_844x390', width: 844, height: 390 },
  { id: 'portrait_390x844', width: 390, height: 844 },
];

async function waitFor(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server not reachable: ${url}`);
}

async function main(): Promise<void> {
  let server: ChildProcess | undefined;
  let base = positional[0];
  if (!base) {
    const port = 4319;
    server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
    base = `http://localhost:${port}/`;
    await waitFor(base, 20000);
  }
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  mkdirSync('docs/qa/screens', { recursive: true });
  const errors: string[] = [];
  try {
    for (const vp of VIEWPORTS.filter((v) => !only || v.id.startsWith(only))) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`[${vp.id}] ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`[${vp.id}] ${e.message}`));
      const url = `${base}${base.includes('?') ? '&' : '?'}${query}`;
      await page.goto(url, { waitUntil: 'load' });
      if (evalJs) {
        await page.waitForTimeout(500);
        await page.evaluate(evalJs);
      }
      await page.waitForTimeout(waitMs);
      if (fps) console.log(`[${vp.id}] fps`, await page.evaluate('window.__debug && window.__debug.stage.guard.fps'));
      const out = `docs/qa/screens/${name}_${vp.id}.png`;
      await page.screenshot({ path: out });
      console.log(`saved ${out}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server?.kill();
  }
  if (errors.length) {
    console.error('Console errors:\n' + errors.join('\n'));
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
