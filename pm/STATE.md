# PM STATE — Coral Express

**Phase:** 8 Ship (final)
**Live URL:** https://coral-express.vercel.app (auto-deploys from main)
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
| T-16 Painterly set + shiny | ART | medium | done |
| T-17 Cinematic video clips | ART | medium | done |
| T-18 Audio + ending + video player | DEV | medium | done (wiring via T-19) |
| T-20 Balance tuning (E1 green) | DEV+CONTENT | high | done (12/14, D-028) |
| T-19 Render fixes, living world, depot scene, loading (+T-18 wiring) | DEV | medium | done |
| T-21 QA E2E suite + screenshot matrix | QA | medium | done (14 bugs) |
| T-22a Fix: world & sights readability | DEV | high | done |
| T-22b Fix: ending, tank decor, offline art | DEV | high | done |
| T-22c Fix: UI typography, phone, depot guard | DEV | high | done |
| T-24 Final polish (+ train-on-rails fix) | DEV | medium | done |
| T-23 Final QA on live build | QA | medium | done (all checks pass; 11/14 old bugs fixed, rest low) |
| T-25 Fix: smooth train motion (producer bug) | DEV | high | done |
| T-16 Painterly set + shiny | ART | medium | done |
| T-17 Cinematic video clips | ART | medium | done |
| T-18 Audio + ending + video player | DEV | medium | done (wiring via T-19) |
| T-20 Balance tuning (E1 green) | DEV+CONTENT | high | done (12/14, D-028) |
| T-19 Render fixes, living world, depot scene, loading (+T-18 wiring) | DEV | medium | done |
| T-21 QA E2E suite + screenshot matrix | QA | medium | done (14 bugs) |
| T-22a Fix: world & sights readability | DEV | high | done |
| T-22b Fix: ending, tank decor, offline art | DEV | high | done |
| T-22c Fix: UI typography, phone, depot guard | DEV | high | done |
| T-24 Final polish (+ train-on-rails fix) | DEV | medium | done |
| T-23 Final QA on live build | QA | medium | done (all checks pass; 11/14 old bugs fixed, rest low) |
| T-25 Fix: smooth train motion (producer bug) | DEV | high | done |
| T-12 Sprite sheets | ART | medium | done |
| T-06 Sim meta (sights, depot, offline, save, markets, requests) | DEV | high | done |
| T-07 Bots + balance.ts | DEV | high | done (1/14 green) |
| T-13 Controller + render from sim | DEV | medium | done |
| T-14 UI screens | DEV | medium | done |
| T-15 Tank View + motion profiles | DEV | medium | done |

## Credits
See pm/CREDITS.md.

## Known issues
- l3s6 postcard must not toast on arrival (D-011).
- 2026-11-24 ~05:55–09:10 UTC: subagents T-06/T-09/T-10/T-12 hit the 5-hour usage limit; resumed at 09:10 via SendMessage with work on disk intact.
- Art known issues: station/l3 has painted rails (crop or regenerate in art-fix pass); station scale differs L1 vs L2/L3 (normalize in render).
- CONTENT todo: add config.todaysSpecial.minPrice (50) + schema (fold into balance tuning ticket).
- 2026-11-24 ~13:5x–14:10 UTC: second usage-limit stop (T-07, T-13, T-14, T-15, T-16); all resumed at 14:11. Mitigation: keep ≤ 4 concurrent subagents from now on.
- T-15 leftovers for polish: fish don't route around decor / hide in castle.
- T-14 gaps: market Shells/s gain ignores bonds; ending/credits screen not built (→ T-18).
- Polish: ending beach segment uses plain procedural backdrop → use l3 far/dusk art.
- 2026-11-24 ~18:xx UTC: third usage-limit stop (T-19, T-20, T-21); resumed 2026-11-25 02:55 UTC.
- Polish backlog: foreground lens garden + white fence are Line-1 style on every Line (use per-Line near art/colors); L3 flamingo/manta hidden behind palms; endless-mode toast after ending not wired.
- PRODUCER BUG (2026-11-25): train hovers above the rails (wheels on grass strip, rails drawn lower/in front) → FIXED in T-24 (wheel bottom 469.7 px vs rail top 470.4 px; PM verified at 2×).
- 2026-11-25 ~03:30 UTC: fourth usage-limit stop (T-20, T-22a/b/c). Resumed T-20 + T-22c at 03:40; T-22a/T-22b queued to resume when a slot frees (keep ≤ 2–3 concurrent to stretch the 5-h window).
- PRODUCER BUG (2026-11-25): train motion not smooth (judder in screen recording) → FIXED in T-25 (D-030).

| T-26 Fix: Stamp Book & UI use real art (producer bug) | DEV | high | done |
| T-27 Fix: missing-partner hint readable + shiny in Tank View (producer bugs) | DEV | high | in progress |

## Ship summary (2026-11-25)
- All tickets T-00…T-25 done. Build green, 179 unit tests, E2E 10/10 local + live.
- E1 balance 12/14 (D-028 accepted deviations: offline speed-up, species dominance).
- Credits: 532.21 spent, 469.79 left.
- Known issues: see docs/qa/FINAL_QA.md (all low).
- PRODUCER BUG (2026-11-25): Stamp Book shows placeholders instead of postcard/station art → FIXED in T-26.
- PRODUCER BUGS (2026-11-25): grey 'ghost' blobs in cars (missing-partner hint unreadable); Tank View ignores shiny sprites → T-27.
