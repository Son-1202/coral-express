# Balance tuning log (T-20, E1)

Harness: `npx tsx scripts/balance.ts --games N` (greedy, random, bondNever, greedyOffline). Debug aids added in T-20: `scripts/balance/trace.ts` (one line per track / terminal / reset per game) and `scripts/balance/peek.ts` (greedy's top candidates and car layout at minute T).
Final numbers: `docs/qa/balance_report.md` (1000 games per bot, 390 s): **12/14 PASS**, 2 accepted deviations below. Start point (T-07): 1/14 PASS.

## Diagnosis that drove the strategy
1. **Reset count was structurally 2.** A Depot Reset needs a terminal reached *this run*, and greedy rides the newest opened Line, so the only possible path was L1 → L2 → L3 (2 resets), whatever the Ticket curve. → rule: Lines open after their previous terminal was reached in `opensAfterRuns` runs (2): L1, L1, L2, L2, L3 = **4 resets**, exactly, in every game.
2. **Tickets exploded** (sqrt of a ×25/×600 bigger economy per Line) → per-Line `ticketDivisor`. With greedy's "projected ≥ 2× total" rule every reset is now threshold-bound: 3, 6, 18, 54 Tickets (total 81, ticketMult ×9.1).
3. **Fares could not reach 25–50% with data.** Appeal is O(10) while fish output spans 13 orders of magnitude (0.25 → 8e12 Sps), so `appeal × 8 × stationMult × fareMult` fell to ~1.5%; scaling appeal with level fixes ×400 but not the ×5-per-tier species ladder. → rule: a car's fare = `fareAppeal(appeal) × its base fish Sps × fareAppealFactor × stationMult` (appeal stays small and readable, decor stays worth buying all game). `fareAppeal` saturates (`A·H/(A+H)`, H = `fareAppealHalf` = 60) because car appeal grows ~6× from Line 1 to Line 3, and the session share is dominated by the final Line 3 minutes (the session ends on the Terminus arrival, the biggest fare).
4. **Line 1 was far too fast** (income e-fold every ~40 s; terminal track bought at 6 min) and the shuttle adds 0–8.5 min of travel randomness to the terminal arrival. → halve all `basePps`, `levelCostGrowth` 1.15 → 1.2, steep L1 track (cheap station 3 for the first pair, expensive terminal), and let the Ticket threshold (`ticketDivisor`) rather than train luck set the first reset.
5. **Bot issues** (bots are the measuring instrument; all are reasonable player behaviour): Mascot by level picked Pebble Damsel (dead weight on the next Line) → highest-output fish (ticket direction 6); "forced" saving for the terminal track blocked all buys after the track was built → only while the track is unbuilt; saving for a level bundle bought nothing for minutes → buys the affordable part of the bundle; carriage/slot plans picked the cheapest fish regardless of the plan's price → score includes it; the track was valued with the new species' raw output only → bond-aware; the track to station 3 must be built before the train leaves station 2 or the Clownfish comes a full round trip later → keeps Shells for a departure-critical track that repays within 150 s; bond-never placed every reef fish into the reef cars and formed the Reef Family by accident (Line 1 has exactly the 3 community species in one habitat) → avoids cars holding a bond partner when it can (the no-bonds baseline the metric needs).

## Rounds (200 games per bot)
| Round | Change | PASS |
|---|---|---|
| T-07 | baseline | 1/14 |
| 1 | rules (fares, opensAfterRuns, ticketDivisor) + bot fixes, old data | — (traces only: 4 resets but runs of 3 min, fares 99%) |
| 2 | basePps ×0.5, levelCostGrowth 1.2, L1 track 32×10^k, divisors 1e6/1e10/1e14, fareAppealFactor 0.1 | 6/14 |
| 3 | pairs ×2, community 2, saturating fare appeal, stationMults flatter, L1 d 4e6, L3 track ×30 | 8/14 |
| 4–6 | departure-aware track reserve (round 4 had a reserve bug that blocked every non-track plan), strict bond-never, L1 track 6×18^k, d1 6e6 | 9/14 |
| 7 | d1 8e6, request rewards 45/60/75 s | 9/14 |
| 8 | bond-never also avoids partners on replace, fareAppealFactor 0.2, L3 track ×35 | 12/14 |
| 9–10 | Garibaldi 4e6 → 1.5e7, L2 trackBase 6e6 (bigger Line 2 entry), L3 track ×45 | 12/14 |

After round 2 (offline, dominance red): wrote the analysis below before trying more strategies; two further attempts on offline (bigger Line 2 entry wall in round 9) moved it only 5% → 6%.

## Accepted deviations (2 rows)
- **Offline 8 h at minute 30: ~5–7% sooner (target 15–35%).** Minute 30 falls early in the first Line 2 run. The break pays 4–5.6 h of the income of that moment (50%, or 70% with Season Pass). Income grows exponentially (e-fold every ~1–1.5 min), so a lump of N seconds of income saves ≈ P·ln(N/P) ≈ 5–7 min, and only in the current run: every reset is Ticket-bound (2× rule) and the reset count is structural, so later runs are unchanged. A bigger Line 2 entry wall (round 9) or a higher offline rate only adds log-terms. Reaching 15–35% needs offline progress to carry across resets (e.g. offline Shells also granting Tickets) — a rule change outside the pre-approved list; flagged to PM.
- **Dominance ≤35% at each reset: median ~59%, p90 ~81%.** Output grows ~×5 per station tier while a level adds +1× (milestones ×2 at 10/25/50), so the newest tier earns most of a run's fish income by its end; replay runs start with the previous run's top fish as Mascot and its species in the Catalogue. The top species changes by run (Pistol Shrimp, Watchman Goby, Icefish, Snow Crab), so no species carries the whole session. Fixing it means re-shaping the basePps ladder (≈×2 per tier), i.e. a content redesign, not tuning.

## Data changes (old → new, reason)
| File | Field | Old → new | Reason |
|---|---|---|---|
| species.json | every `basePps` | ×0.5 (0.5→0.25 … 1.6e13→8e12) | Line 1 income e-folded every ~40 s; slows every run ~2× with costs unchanged |
| species.json | garibaldi `baseCost` | 4e6 → 1.5e7 | Line 2 entry is a real step (bought from the Goby Mascot's copies) and an offline break there pays off |
| config.json | `levelCostGrowth` | 1.15 → 1.2 | late levels were the cheapest growth; slows mid/late runs, early levels barely change |
| config.json | `fareAppealFactor` | 8 → 0.2 | new fare rule (× car fish Sps): fares 25–50% |
| config.json | `fareAppealHalf` | — → 60 | new: saturating fare appeal, keeps the fare share stable from Line 1 (car appeal ~30) to Line 3 (~150) |
| config.json | `stationMults` | [1,1.4,2,2.8,4,6] → [1,1.3,1.6,2,2.5,3] | the Terminus arrival ends the session; a ×6 terminal fare made the session share swing |
| config.json | `communityBonus` | 1.0 → 2.0 | bonds must be worth ≥25% of income (bond-never targets) |
| config.json | `todaysSpecial.minPrice` | — → 50 | D-023 (schema added) |
| bonds.json | pair `bonus` | 0.5 → 1.0, 0.4 → 0.8 | bond-never targets |
| lines.json | L1 `trackBase`/`trackGrowth` | 120/8 → 6/18 (s3 108, s4 1.9k, s5 35k, s6 630k) | station 3 cheap enough for the first pair ≤2.5 min, terminal late enough for a 15–20 min first run, cheap enough for random's 35–70 min |
| lines.json | L2 `trackBase` | 3e6 → 6e6 | Line 2 pacing with the new Mascot |
| lines.json | L3 `trackBase`/`trackGrowth` | 7.5e10/8 → 1e12/45 | the final run arrives with ticketMult ×9 and a Snow Crab Mascot; needs ~12–15 min |
| lines.json | `ticketDivisor` | — → 8e6 / 3e10 / 1e14 | per-Line Tickets: 3, 6, 18, 54 |
| lines.json | L2, L3 `opensAfterRuns` | — → 2 | 4 resets before the Terminus |
| src/story/requests.json | `reward.seconds` | 180 → 45, 240 → 60, 300 → 75 | request share 5–15% (ticket direction 5) |

## Rule changes (each has unit tests in `tests/unit/sim/t20rules.test.ts`; documented in `src/sim/README.md` §26–29 and GDD)
1. Fares scale with car fish output and saturating appeal (`income.ts` `fareAppeal`, `TrainModel.fareWeight`, `fareBaseMult` no longer has `fareMult_line` × ticketMult — both are inside the car's Sps). `lines[].fareMult` now only prices carriages.
2. `lines[].opensAfterRuns` + `permanent.terminalRuns` (`train.ts`); saves without it migrate to `{}`.
3. `lines[].ticketDivisor` (`depot.ts projectedTickets`) — the UI already reads `projectedTickets()`.
Sim unit tests now use a frozen SPEC-era fixture (`tests/unit/sim/fixtureData.ts`) so rule tests don't follow tuning.

## Follow-ups for PM / other roles
- UI `src/ui/trackMap.ts` says "Reach the Line N terminal" for locked Lines; with `opensAfterRuns` 2 it should read e.g. "Reach the Line 1 terminal in 2 runs (1/2)" from `permanent.terminalRuns` (DEV/UI).
- Offline carry-over rule (see deviations) if the 15–35% target matters.
- 5000-game confirmation would take ~30 min on this shared box (1000 games ≈ 6–7 min); 1000 was run.
