# QA Report — T-21 (E2E suite + screenshot matrix)

**Build:** local `npm run build` on 2026-11-25 (T-19/T-20 still landing). **Runner:** `node tests/e2e/run.cjs` (vite preview :4173; ending beats also use the vite dev preview page on :5179).
**Suite time:** 306 s for the full run (target < 6 min). **Raw results:** `docs/qa/e2e_results.json`. **Screens:** `docs/qa/screens/QA_*.png` (54 files).

## Pass / fail per check
| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Smoke: title loads, no console errors | PASS | 0 console/page errors in the final run (see bug 12 for one transient 404) |
| 2 | Full session (buy via Market UI → feed (Space) → M/T/S/D → depotReset + Mascot via UI → line2 → line3 → forceWin → ending → Skip → endless) | PASS* | *Depot Reset granted **0 Tickets** (bug 2). The ending overlay is now wired (T-19). Endless flag is set. |
| 3 | Offline popup (save back-dated 1 h) | PASS | Title shows "Continue · away 1h". Postcard shows Time away 1h, Shells 450, Stations 70. |
| 4 | Save/load, plus a corrupted save | PASS | Progress kept after reload. A corrupted save boots a fresh game with no crash. |
| 5 | Tank View: Enter → watch, E + drag from tray places decor, P photo, Esc exits | PASS | Leaving takes about 6.7 s on swiftshader (Esc ×2 and the dolly-out). |
| 6 | Screenshot matrix: 3 Lines × 4 times of day, 6 Sights, 5 market tabs, car detail with a community, track/stamps/depot/settings | PASS (captured) | See the visual bugs below. |
| 6b | Phone 844×390 train + market; portrait rotate card | PASS | Panel is 40% wide. One touch target is < 44 px (bug 10). |
| 6c | Ending beats (beach, postcard, panorama, theEnd, credits) + in-game ending | PASS (captured) | Visual bugs 5 and 6. |
| 7 | Motion: zoo frames at 0/0.5/1/2 s, per-cell diff (45 cells) | PASS | vent_3 has `amp 0`, so it is static by data and whitelisted. Crawlers (snow_crab) can rest for over 1 s, so the check uses a 2 s window. |
| 7b | Train view 3-frame sequence per Line | PASS | 76% / 99% / 99% of pixels changed between frames. |

## Bugs (proposed T-fix tickets)
1. **[HIGH] "fi" ligature renders as "A" in Pixelify Sans.** Every lowercase "fi" is affected: "ClownAsh" (car detail, stamp book, catalogue), "your Arst Pebble Damsel" (tutorial tip 1), "Free Ash slot" (Today's Special). Fix: `font-variant-ligatures: none` (or `font-feature-settings: "liga" 0`) on the UI root. Screens: `QA_car_detail_community.png`, `QA_market_special.png`, `QA_panel_stamps.png`. Low-severity sibling: at small sizes the heading weight makes "C" look like "O" ("Ohange habitat", "Masoot").
2. **[HIGH] Depot Reset after `skipTo('depotReset')` grants 0 Tickets.** The Depot card shows "+0 Tickets" and the Reset button is still enabled. Debug resets for line2/line3 also leave Tickets at 0. Cause: `skipTo` only lifts `runShells` to `minRunShells`, which projects 0 Tickets with the current balance (T-20). Fix: either the debug grants enough for at least 1 Ticket, or (game rule) the reset is disabled or warns when the projection is 0. Repro: `session` check, details in `e2e_results.json`.
3. **[HIGH] Sights are nearly invisible in the train view.** `whale_breach` shows nothing on Line 1 because the sea is hidden behind the mid houses. `dolphin_race` is a tiny blurred grey shape behind the houses. `festival_station` and `stowaway` have no visible change. Only `seagull_thief` (a small gull on the roof) and `sea_fog` read. Players can't see or tap Sights. Screens: `QA_sight_*.png`.
4. **[MED] The near/foreground layer is Line 1's on every Line.** The white picket fence, pastel flower bushes and sandstone wall also appear on Fog Fjords and Volcano Isles, which clashes with the B9 art direction. Screens: `QA_train_l2_*.png`, `QA_train_l3_*.png`.
5. **[MED] Ending beach beat looks unfinished.** The carriages are empty glass frames, with no water and no fish, and there are 3 of them even when the player owns 1. The black sand is a flat grey rectangle with a hard edge. Steam is drawn as flat white circles, which is off-style. Screens: `QA_ending_ingame.png`, `QA_ending_beach.png`.
6. **[MED] Ending panorama caption is unreadable.** The caption text sits on top of the floor fish (crabs, rocks) with no backing plate. Sprites also overlap each other (manta over clownfish). The credits beat has a large empty black gap before the credits scroll in. Screens: `QA_ending_panorama.png`, `QA_ending_credits.png`.
7. **[MED] Car detail panel hides the selected car.** The panel opens over the loco end, and the heritage car stays behind it. The camera should pan so the selected car is visible to the left of the panel. Screen: `QA_car_detail_community.png`.
8. **[MED] Fog Fjords looks washed out.** The whole frame is low contrast and the station sign "Grimsvik Quay" is unreadable (fog plus tilt-shift). The Kelp car interior is a dark herringbone/chevron pattern, not kelp. Screen: `QA_train_l2_afternoon.png`.
9. **[LOW] Toasts pile up and cover the scene.** Three stacked toasts take about 40% of the phone screen width and cover the train (`QA_phone_train.png`, `QA_phone_market.png`). Fix: cap at 2 on phone or collapse them.
10. **[LOW] A touch target under 44 px on phone.** One of `.hud-btn` / `.ui-cog` / `.ui-close` is below 44 px at 844×390 (B7/C rule). The HUD station label wraps to two lines on phone.
11. **[LOW] Decor floats mid-water.** Sea-Glass Pebbles dropped in mid-water stay floating; floor decor should snap to the sand (`QA_tank_decorate.png`). The offline postcard art is the procedural placeholder (sun and sea), not painted art (`QA_offline_popup.png`).
12. **[LOW / env] Transient 404s for `/passengers/p{4,6,12}.png`.** Seen once while another agent rebuilt `dist/` mid-run. Not reproduced on a stable build. Re-check on the deploy.
13. **[LOW] Sights linger.** After `triggerSight` and `fastForward(40)`, the seagull is still on the roof and a "Seagull Thief −3.6M" toast fires during the next sight (`QA_sight_whale_breach.png`).
14. **[LOW] Zoo cells are hard to read.** Many species are too small or not visible in their cells, and the labels are very small (dev page only, `QA_zoo_t0.png`).

## Notes
- FPS is not meaningful in headless swiftshader. A real-GPU check is still needed.
- Proposed npm script (for the PM to add): `"e2e": "node tests/e2e/run.cjs"`. Run `npm run build` first.
