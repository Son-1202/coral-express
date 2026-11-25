# Coral Express

An idle HD-2D aquarium game on rails. Inherit Grandma Wren's seaside train of glass aquarium carriages, match symbiotic fish partners, and ride three coastal Lines — Sunny Coast, Fog Fjords and Volcano Isles — to the Grand Terminus.

**Play:** https://coral-express.vercel.app (auto-deploys from `main`)

## How to play
- Shells tick in from your fish; every station arrival pays fares from passengers admiring your tanks.
- Each arrival opens that station's market (fish stall, decor & plants, Today's Special, Passenger Requests). It stays open until the next arrival.
- Put partner species in the same carriage (Clownfish + Carpet Anemone, Pistol Shrimp + Watchman Goby, …) and complete three-species communities for big bonuses.
- Lay track to new stations, then take a **Depot Reset** for Tickets (permanent income and upgrades). Your Heritage Carriage and Mascot fish come with you.

## Controls
| Action | Touch / mouse | Keyboard |
|---|---|---|
| Feed a carriage (×3 for 10 s) | tap the carriage | `Space` (best carriage) |
| Car detail | long-press / right-click | — |
| Tank View (watch, decorate, photo) | double-tap a carriage | `Enter`, then `E` decorate, `P` photo |
| Pan along the train | drag / scroll | `←` `→`, `1`–`8` |
| Panels | bottom bar | `M` Market · `T` Track · `S` Stamps · `D` Depot |
| Close / leave | ✕ / back | `Esc` |
| Sights (dolphins, gull, stowaway) | tap them | — |

## Develop
```bash
npm install
npm run dev        # Vite dev server
npm run build      # typecheck + production build (dist/)
npm run test       # Vitest unit tests (sim, bots, UI helpers, tank)
npm run e2e        # Playwright session suite (run after `npm run build`)
npx tsx scripts/balance.ts --games 200   # headless E1 balance report → docs/qa/balance_report.md
```
Debug: `?debug=zoo` shows every species, plant and Sight animating; `window.__debug` exposes `skipTo`, `forceWin`, `runBot`, `addShells`, `fastForward`, `triggerSight`, `simulateOffline`, `setTimeOfDay`.

## Project layout
- `src/sim` — pure deterministic game rules (no DOM), `src/bots` — balance bots
- `src/render` — Three.js HD-2D diorama, train, tanks, VFX, ending · `src/ui` — DOM panels · `src/audio` — music + procedural SFX
- `src/data`, `src/story` — all tunable numbers and text
- `assets/` — generated art, audio and video (Higgsfield); `docs/` — spec, GDD, art logs, QA reports; `pm/` — production log

## Credits
Game by Son-1202. Built with Claude Code. Art: Higgsfield (Nano Banana Pro, GPT Image); music: ElevenLabs via Higgsfield; video: Kling via Higgsfield. Fonts: Pixelify Sans, Silkscreen.
