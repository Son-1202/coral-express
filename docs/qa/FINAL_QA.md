# Final QA — T-23 (2026-11-25)

**Build:** bundle `assets/index-BjT44AUC.js`. It is the same in the local `npm run build` and on https://coral-express.vercel.app, so the live site has the T-24 rail fix.
**Runners:**
- `npm run build && npm run e2e`: the full local suite.
- `node tests/e2e/run.cjs --url=https://coral-express.vercel.app/ smoke session offline saveLoad tankView motionTrain`: the live checks. `--url` is new in T-23.
- `node tests/e2e/ship.cjs [01..06] [--url=…]`: the ship screenshots.

**Raw results:** `docs/qa/e2e_results.json` (local) and `docs/qa/e2e_results_live.json` (live).

## Checks
| # | Check | Local | Live | Notes |
|---|---|---|---|---|
| 1 | Smoke (title, canvas, no console errors) | PASS | PASS | 0 console errors, page errors, 404s or failed requests on either build |
| 2 | Full session (Market UI buy → feed → M/T/S/D → Depot Reset + Mascot → line2 → line3 → forceWin → ending → Skip → endless) | PASS | PASS | Depot Reset now grants +3 Tickets |
| 3 | Offline popup (save back-dated 1 h) | PASS | PASS | Uses the painted postcard art |
| 4 | Save/load + corrupted save | PASS | PASS | |
| 5 | Tank View (Enter, decorate drag, photo, Esc) | PASS | PASS | Exit takes 3.4 s; T-21 measured 6.7 s |
| 6 | Screenshot matrix (3 Lines × 4 times of day, Sights, market tabs, panels) | PASS | n/a | 28 shots in `screens/QA_*` |
| 6b | Phone 844×390 + portrait rotate card | PASS | n/a | 0 touch targets under 44 px |
| 6c | Ending beats (preview page) | PASS | n/a | |
| 7 | Motion: zoo cell diff at 0/0.5/1/2 s (45 cells) | PASS | n/a | Every cell moves within 1 s; vent_3 has amp 0, which is in the data |
| 7b | Train view 3-frame sequence per Line | PASS | PASS | Pixels changed: L1 76%, L2 99.9%, L3 98.5% |
| 8 | Ship screenshots, wheels on rails | PASS | same bundle | Checked on 2× crops of every train shot: wheel bottoms touch the rail head, with no gap and no grass showing |

Local suite time: 285 s. Live subset: 150 s.

## T-21 bug status
| # | Bug | Status |
|---|---|---|
| 1 | "fi" ligature shows as "A" | **FIXED** ("Clownfish" renders correctly) |
| 2 | Depot Reset after skipTo grants 0 Tickets | **FIXED** (+3 Tickets; the 0-ticket guard comes from T-22c) |
| 3 | Sights invisible in the train view | **FIXED** (whale, dolphins and festival bunting are all clearly visible) |
| 4 | Line 1 foreground on every Line | **FIXED** (L2 has a log fence and lupins; L3 has a bamboo fence, ferns and hibiscus) |
| 5 | Ending beach unfinished | **FIXED** (glass cars hold water and fish, plus painted sunset art) |
| 6 | Panorama caption unreadable; credits gap | **FIXED** in the preview (caption on a cream plate). LOW: in-game, just after `seek('panorama')`, the caption shows briefly at the bottom over the floor crabs with no plate (`screens/T-23_ending_panorama.png`) |
| 7 | Car detail panel hides the selected car | **FIXED** (camera centres the car left of the panel, see ship 04) |
| 8 | Fog Fjords washed out / sign unreadable / Kelp interior | **FIXED** for contrast and sign. **OPEN (LOW):** the Kelp car backdrop still reads as a dark zigzag with kelp strands |
| 9 | Toasts pile up on phone | **FIXED** (capped at 2) |
| 10 | Touch target under 44 px | **FIXED** (0 found) |
| 11 | Decor floats; offline art is a placeholder | **FIXED** (decor snaps to the sand; painted postcard) |
| 12 | Transient 404s for passengers | **FIXED** (0 HTTP errors on live) |
| 13 | Seagull Thief toast lingers | **WONTFIX**, by design: the thief toast is the miss penalty |
| 14 | Zoo cells hard to read | **OPEN (LOW)**, dev-only page |

## Known issues
| Severity | Issue |
|---|---|
| LOW | Kelp car backdrop is a dark zigzag pattern (bug 8 remainder). |
| LOW | In-game panorama caption flashes at the bottom without a plate before it settles (bug 6 remainder). |
| LOW | In dense L2/L3 cars, some fish appear briefly dithered or semi-transparent, which looks like the depth or hide-behind-decor fade. They read as grey smudges in stills. |
| LOW | Vent cars on Line 3 are dark, so the grey vent species have low contrast against the backdrop. |
| LOW | Zoo dev page: the species cells are tiny (bug 14). |
| INFO | FPS was not measured: headless swiftshader only. A real-GPU pass is still recommended. |

## Ship screenshots (`docs/qa/ship/`, 1280×720 @2×)
`01_line1` Sunny Coast at Santa Brezza (3 cars, Reef/Mangrove communities, decor) · `02_line2` Fog Fjords at Grimsvik Quay (Kelp/Polar) · `03_line3` Volcano Isles at Kahiko Landing (Vent, ghost ray, pocket whale) · `04_car_detail_community` Mangrove Crew +200% ACTIVE, with the car visible left of the panel · `05_depot` +3 Tickets preview, Mascot picker, Line picker · `06_ending` the volcano-sunset dive beat with the train running into the sea.

`ship.cjs` hides toasts, tutorial tips and Line splashes. It holds Sights off, parks the train at a station and frames the whole train.

## Top 5 improvements for v2
1. **Brighter vent and kelp interiors.** Add a rim light or lighter backdrop so the dark-habitat fish read in the train view.
2. **Auto-framing camera.** Fit the camera to the whole train (loco + N cars) at stations, instead of following the loco, so long trains stay on screen.
3. **Real-GPU performance pass**, with an FPS budget on mid-range phones (post-processing quality tiers, sprite batching).
4. **Sights that you can tap and follow.** A short camera nudge or highlight ring when a Sight starts, with the reward toast tied to it.
5. **Tank View fish routing.** Fish should go around decor and hide in castles (T-15 leftover), and the dithered fade should be replaced with proper occlusion.
