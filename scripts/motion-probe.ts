/**
 * Motion probe (T-25): drives the game with a virtual rAF clock and measures how
 * smoothly the train and camera move, frame by frame.
 *
 *   npx tsx scripts/motion-probe.ts [--url http://localhost:5173/] [--strip NAME] [--json out.json]
 *
 * Without --url it starts `vite preview` on `dist/` (run `npm run build` first).
 * Scenarios: cruise at 60 fps, 30 fps and irregular 16/33 ms frames (5 s, mid-leg), plus an
 * arrival + departure pass at 60 fps. For each it reports:
 *  - worldCV   stdev/mean of the locomotive's world speed per frame (Δx/Δt) during cruise
 *  - camCV     the same for the camera (= how evenly the background scrolls)
 *  - jitterPx  stdev of the locomotive's frame-to-frame screen-X delta (px; 0 = glued to the screen)
 *  - reversals sign flips of the per-frame world delta (train going backwards)
 *  - maxJerkPx largest frame-to-frame change of the loco's screen delta (px)
 * --strip NAME saves 12 consecutive cruise frames to docs/qa/screens/NAME_01..12.png.
 * Exits 1 when a cruise scenario fails (worldCV ≥ 5 %, camCV ≥ 5 %, any reversal).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
interface PwPage {
  on(ev: 'pageerror', fn: (e: Error) => void): void;
  addInitScript(js: string): Promise<void>;
  goto(url: string, o: { waitUntil: 'load' }): Promise<unknown>;
  evaluate<T>(js: string): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(o: { path: string }): Promise<unknown>;
  close(): Promise<void>;
}
interface PwBrowser {
  newPage(o: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PwPage>;
  close(): Promise<void>;
}
function loadPlaywright(): { chromium: { launch(o?: { args?: string[] }): Promise<PwBrowser> } } {
  try {
    return require('playwright');
  } catch {
    return require('/opt/node22/lib/node_modules/playwright');
  }
}

const args = process.argv.slice(2);
const flag = (n: string): string | undefined => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/** Virtual clock: rAF callbacks queue up and run only when the probe steps the clock. */
const INIT = `
(() => {
  const vc = { now: 0, q: [], id: 1 };
  window.__vc = vc;
  window.requestAnimationFrame = (cb) => { vc.q.push({ id: vc.id, cb }); return vc.id++; };
  window.cancelAnimationFrame = (id) => { vc.q = vc.q.filter((e) => e.id !== id); };
  performance.now = () => vc.now;
  vc.step = (ms) => {
    vc.now += ms;
    const q = vc.q; vc.q = [];
    for (const e of q) e.cb(vc.now);
  };
})();`;

/** In-page: step `frames` frames with the given ms pattern and sample after each. */
const SAMPLE = `
(opts) => {
  const d = window.__debug, st = d.stage, game = st.game, cam = st.rig.camera;
  const W = innerWidth, out = [];
  const toPx = (x, y, z) => { const v = { x, y, z }; const p = new st.train.group.position.constructor(x, y, z).project(cam); return (p.x + 1) / 2 * W; };
  for (let i = 0; i < opts.frames; i++) {
    const ms = opts.pattern[i % opts.pattern.length];
    window.__vc.step(ms);
    const g = st.train.group.position;
    const lx = g.x + (st.train.centers[0] || 0);
    const pose = game.pose();
    out.push({ ms, lx, cx: cam.position.x, sx: toPx(lx, g.y + 0.6, g.z), ppu: toPx(lx + 1, g.y + 0.6, g.z) - toPx(lx, g.y + 0.6, g.z),
      phase: pose.phase, prog: pose.progress, t: game.sim.state.train.t, simPhase: game.sim.state.train.phase, acc: game.sim.state.tickAcc });
  }
  return out;
}`;

interface Sample { ms: number; lx: number; cx: number; sx: number; ppu: number; phase: string; prog: number; t: number }

const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const stdev = (a: number[]): number => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};

function analyse(s: Sample[]): Record<string, number> {
  const vW: number[] = [], vC: number[] = [], dS: number[] = [], dW: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!, b = s[i]!;
    const dt = b.ms / 1000;
    dW.push(b.lx - a.lx);
    vW.push((b.lx - a.lx) / dt);
    vC.push((b.cx - a.cx) / dt);
    dS.push(b.sx - a.sx);
  }
  let reversals = 0;
  for (let i = 1; i < dW.length; i++) if (Math.sign(dW[i]!) !== Math.sign(dW[i - 1]!) && Math.abs(dW[i]!) > 1e-9 && Math.abs(dW[i - 1]!) > 1e-9) reversals++;
  let maxJerk = 0;
  for (let i = 1; i < dS.length; i++) maxJerk = Math.max(maxJerk, Math.abs(dS[i]! - dS[i - 1]!));
  const ppu = mean(s.map((x) => x.ppu));
  return {
    worldSpeed: mean(vW),
    worldCV: stdev(vW) / Math.max(1e-9, Math.abs(mean(vW))),
    camCV: stdev(vC) / Math.max(1e-9, Math.abs(mean(vC))),
    scrollPxPerFrame: mean(dS.map((_, i) => (vC[i]! * s[i + 1]!.ms) / 1000)) * ppu,
    jitterPx: stdev(dS),
    maxJerkPx: maxJerk,
    reversals,
    zeroFrames: dW.filter((x) => Math.abs(x) < 1e-9).length,
  };
}

async function waitFor(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server not reachable: ${url}`);
}

async function main(): Promise<void> {
  let server: ChildProcess | undefined;
  let base = flag('url');
  if (!base) {
    const port = 4327;
    server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
    base = `http://localhost:${port}/`;
    await waitFor(base, 20000);
  }
  const strip = flag('strip');
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results: Record<string, Record<string, number>> = {};
  /** --raw: also dump every per-frame sample into the --json file. */
  const raw: Record<string, Sample[]> = {};
  let failed = false;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    await page.addInitScript(INIT);
    // warp 6 s (stop) + 12 s, +6 s warmup → cruise (ramps end at 11.25 s) (45 s legs, 25 % ramps)
    await page.goto(`${base}?new=1&nosave=1&title=0&quality=low&seed=7&warp=18`, { waitUntil: 'load' });
    for (let i = 0; i < 400; i++) {
      if (await page.evaluate<boolean>('!!(window.__debug && window.__debug.stage)')) break;
      await page.waitForTimeout(50);
    }
    // let the loader settle and the camera converge (real timers keep running; rAF is virtual)
    await page.waitForTimeout(1500);
    const run = (frames: number, pattern: number[]) => page.evaluate<Sample[]>(`(${SAMPLE})(${JSON.stringify({ frames, pattern })})`);
    // ?warp moves the train before the first frame: let the camera catch up (follow lag decays at 2.2/s)
    await run(360, [16.6667]);
    const scen: [string, number[], number][] = [
      ['cruise_60fps', [16.6667], 300],
      ['cruise_30fps', [33.3333], 150],
      ['cruise_irregular_16_33', [16, 33], 180],
    ];
    for (const [name, pattern, frames] of scen) {
      const s = await run(frames, pattern);
      const r = analyse(s);
      r.progFrom = s[0]!.prog;
      r.progTo = s[s.length - 1]!.prog;
      results[name] = r;
      raw[name] = s;
      const ok = r.worldCV < 0.05 && r.camCV < 0.05 && r.reversals === 0 && s.every((x) => x.phase === 'moving');
      if (!ok) failed = true;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, JSON.stringify(r, (_, v: unknown) => (typeof v === 'number' ? +v.toFixed(4) : v)));
    }
    if (strip) {
      mkdirSync('docs/qa/screens', { recursive: true });
      for (let i = 1; i <= 12; i++) {
        await run(1, [33.3333]);
        await page.screenshot({ path: `docs/qa/screens/${strip}_${String(i).padStart(2, '0')}.png` });
      }
      console.log(`strip saved docs/qa/screens/${strip}_01..12.png (30 fps steps)`);
    }
    // arrival + stop + departure: jump close to the end of the leg, then ride through the stop
    const t = await page.evaluate<number>('window.__debug.stage.game.sim.state.train.t');
    const legLeft = 45 - t - 3;
    for (let k = 0; k < Math.ceil((legLeft * 1000) / 100); k++) await run(1, [100]);
    const arr = await run(60 * 20, [16.6667]);
    const ra = analyse(arr);
    const phases = arr.map((x) => x.phase).filter((p, i, a) => i === 0 || p !== a[i - 1]).join('>');
    // smooth stop/start: no backwards step, and the loco's screen delta never jumps by > 1.5 px in one frame
    const okA = ra.reversals === 0 && ra.maxJerkPx < 1.5;
    if (!okA) failed = true;
    results.arrival_departure_60fps = ra;
    raw.arrival_departure_60fps = arr;
    console.log(`${okA ? 'PASS' : 'FAIL'} arrival_departure_60fps (${phases})`, JSON.stringify(ra, (_, v: unknown) => (typeof v === 'number' ? +v.toFixed(4) : v)));
    await page.close();
  } finally {
    await browser.close();
    server?.kill();
  }
  const out = flag('json');
  if (out) writeFileSync(out, JSON.stringify(args.includes('--raw') ? { results, raw } : results, null, 2));
  if (failed) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
