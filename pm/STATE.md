# PM STATE — Coral Express

**Phase:** 3–4 (sim meta, art, render, Tank View in parallel)
**Live URL:** https://coral-express.vercel.app (auto-deploys from main; first green deploy = T-01 efa824a)
**Repo:** https://github.com/Son-1202/coral-express (branch `main`)

## Preflight (2026-11-24)
- GitHub: REST `gh api` works, push to main works.
- Vercel: no token in container (producer declined); producer imports repo in dashboard.
- Higgsfield: 122 credits at start; producer topped up → 970 (D-015).
- Advisor: unavailable (D-001).

## Ticket board
| Ticket | Role | Effort | Status |
|---|---|---|---|
| T-00 Preflight + skeleton | PM | high | done |
| T-01 Scaffold + diorama | DEV | medium | done |
| T-02 Data files + schema | CONTENT | medium | done |
| T-03 Story text | CONTENT | medium | done |
| T-04 Style bible candidates | ART | medium | done (B chosen) |
| T-08 Pixelize pipeline | DEV | medium | done |
| T-09 Line 1 hero art | ART | medium | done |
| T-05 Sim core | DEV | high | done |
| T-10 Lines 2–3 art | ART | medium | done |
| T-11 Music + ambience | ART | medium | done |
| T-12 Sprite sheets | ART | medium | done |
| T-06 Sim meta (sights, depot, offline, save, markets, requests) | DEV | high | done (T-06-b tweak running) |
| T-07 Bots + balance.ts | DEV | high | in progress |
| T-13 Controller + render from sim | DEV | medium | in progress |
| T-14 UI screens | DEV | medium | in progress |
| T-15 Tank View + motion profiles | DEV | medium | in progress |

## Credits
See pm/CREDITS.md.

## Known issues
- l3s6 postcard must not toast on arrival (D-011).
- 2026-11-24 ~05:55–09:10 UTC: subagents T-06/T-09/T-10/T-12 hit the 5-hour usage limit; resumed at 09:10 via SendMessage with work on disk intact.
- Art known issues: station/l3 has painted rails (crop or regenerate in art-fix pass); station scale differs L1 vs L2/L3 (normalize in render).
