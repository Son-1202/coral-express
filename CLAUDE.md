# Coral Express — rules for every agent

**Read `pm/STATE.md` first, then your ticket `pm/tickets/T-XX.md`.** The full game spec is `docs/content/SPEC.md` (read only the sections your ticket names).

## Stack
- Vite + TypeScript (strict) + Three.js + `postprocessing` (pmndrs) + Howler. Static site, deployed on Vercel (`npm run build` → `dist/`).
- Tests: Vitest (`npm run test`, files in `tests/unit/**`). E2E: Playwright (pre-installed globally: `require('playwright')`, `chromium.launch()` needs no options; never run `playwright install`). Pass `--trace off`.
- Scripts run with `tsx` (`npx tsx scripts/foo.ts`).
- Node 22.

## Ownership (strict — write only inside your role's paths)
| Role | May write |
|---|---|
| DEV | `src/**` except `src/data/**` and `src/story/**`; `scripts/**`; `tests/unit/**`; root configs (`package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `vercel.json`) |
| CONTENT | `src/data/**`, `src/story/**`, `docs/content/**` |
| ART | `assets/**`, `docs/art/**` |
| QA | `tests/e2e/**`, `docs/qa/**` (read-only elsewhere) |

Everyone may write their own `pm/handoffs/T-XX.md`. **Only the PM runs git, deploy, or edits other `pm/**` files.** Never run `git commit`/`git push`.

## Architecture (mandatory)
- `src/sim/` = pure TS game rules. Deterministic, seeded RNG, **no DOM / Three / window imports**. Emits typed events (`purchase`, `levelUp`, `milestone`, `bondFormed`, `frenzy`, `arrive`, `depart`, `fare`, `sightStart`, `sightEnd`, `trackBuilt`, `lineOpened`, `depotReset`, `ending`, …).
- `src/render/` consumes sim state + events → Three.js scene, tweens, VFX. All procedural animation lives in `src/render/anim/`.
- `src/ui/` = DOM HUD/panels (plain TS + CSS, no framework).
- `src/data/*.json` = all tunable numbers and content (CONTENT owns). Code must read numbers from data, never hard-code balance values.
- Single `formatNumber()` helper for all big numbers.
- Fixed sim tick 0.25 s. `sim.advance(s)` must be tick-invariant (≤0.1%).

## Code style
- Strict TS, no `any` unless justified in a comment. ES modules. Small files (< ~400 lines). Named exports.
- No sprite-sheet animation: all motion is procedural (shaders / tweens).
- Sprites: `NearestFilter`, billboards/planes, 1px outline baked by `scripts/pixelize.ts`.
- Asset paths are referenced through `src/assets.ts` manifest (DEV) so missing art falls back to procedural placeholders and the game never crashes on a missing file.

## Art STYLE BLOCK (prepend to every Higgsfield prompt)
> HD-2D pixel art, crisp pixel sprites on a painterly 3D miniature diorama, tilt-shift toy-model depth of field, vintage seaside train with glass aquarium carriages, seafoam green and cream paint, brass trim, riveted glass, cozy picture-book mood, gouache texture, gentle haze, no text, no watermark, no UI

For isolated sprites, follow the block with: "single isolated subject, side view facing right, centered, on a plain flat solid light grey background, no shadow on the ground" (or whatever the ticket specifies) so background removal is clean.

## Context discipline
- If you are running low on context or the ticket is bigger than expected: STOP, write `pm/handoffs/T-XX.md` (done / remaining / exact next steps / files touched) and report.
- Final report ≤ 150 words. Details go in files.
