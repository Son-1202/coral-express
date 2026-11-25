# Coral Express — GDD (systems + formulas)

Source of truth: `docs/content/SPEC.md` (B4, B5, E1). All numbers live in `src/data/*.json`, typed by `src/data/schema.ts` (`loadGameData()`), checked by `src/data/validate.ts` (`validateGameData()` returns error strings). Notation: `config.x` = key in `config.json`.

## Loop
Train shuttles over built track on one Line (`lines.json`), `config.legSeconds` per leg, `config.stopSeconds` per stop. Fish earn Shells/s continuously; each arrival pays a fare burst and opens that station's market. Buy track → new station → new signature species. Reach terminal + `config.depotReset.minRunShells` → Depot Reset for Tickets.

## Run start
Shells `config.startShells` (+ `spare_change`: 500 × totalTicketsEarned). Track built to station `config.startTrackStation`. `config.startCarriages` carriage (the Heritage Carriage) with `config.startSlots` slots (`double_decker` → 5). Mascot starts at level `config.mascot.startLevel`, ignores habitat penalty.

## Costs
| Thing | Formula | Keys |
|---|---|---|
| Track to station k (k=2..6) | `trackBase × trackGrowth^(k-2)` | `lines[].trackBase`, `lines[].trackGrowth` |
| Carriage n (n≥2) | `carriageBase × carriageGrowth^(n-2) × fareMult_line` | `config.carriageBase/Growth`, `lines[].fareMult` (since T-20 it prices carriages only, not fares); cap `config.maxCarriages` |
| Habitat change | `habitatChangeFactor × carriagePrice` | `config.habitatChangeFactor` |
| Extra slot | `slotCostFactor × carriagePrice × slotGrowth^extraSlotsBought` | `config.slotCostFactor/slotGrowth`; cap `config.maxSlots` |
| Fish copy | `baseCost × copyCostGrowth^copiesOwned` (first Pebble Damsel free) | `species[].baseCost`, `config.copyCostGrowth`, `flags.firstFree` |
| Level-up | `baseCost × levelCostGrowth^level`, max `config.maxLevel` | `config.levelCostGrowth` |
| Decor copy | `baseCost × decorCopyGrowth^copiesOwned` | `decor[].baseCost`, `config.decorCopyGrowth` |
| Sell | refund `sellRefund × totalSpent` | `config.sellRefund` |
| Species cost mult | ×0.75 with `fishmonger` | `upgrades.json` `speciesCostMult` |

Decor capacity per car = `decorCapacityBase + decorCapacityPerSlot × extraSlotsBought`.

## Income
```
fishSps   = basePps × level × milestoneMult × habitatMult × bondMult × frenzyMult × ticketMult × upgradeMults × decorMult
milestoneMult = milestones.mult ^ (count of milestones.levels ≤ level)
habitatMult   = 1 if fish habitat == car habitat (or flags.alwaysHome / Mascot), else offHabitatMult
bondMult      = 1 + Σ pair bonuses (+ pairBonusPP from decor/upgrades) + communityBonus (+ communityBonusPP)
ticketMult    = 1 + ticketIncomePerTicket × totalTicketsEarned
decorMult     = 1 + carIncome + habitatIncome(matching habitat)  (same decor id does not stack in one car)
whale: all fish × (1 + perDistinctSpeciesBonus × distinctSpeciesOnTrain)
appeal_car = Σ(appeal × appealCount × habitatMult × (shiny ? shinyAppealMult : 1)) + Σ decor appeal + communityAppeal(if community)
fare       = Σ_car fareAppeal(appeal_car) × baseSps_car × fareAppealFactor × stationMults[station-1] × upgradeMults   (T-20)
fareAppeal(A) = A × fareAppealHalf / (A + fareAppealHalf)   (saturating; baseSps_car already holds ticketMult, bonds, habitat, decor)
```
Endless mode: fares × `config.endless.fareMult`. Old Friend (same Mascot species `mascot.oldFriendStreak` resets running): +`mascot.oldFriendBonus` output.

## Bonds (`bonds.json`)
Pairs `{a,b,bonus}`: both in the same car → each gets `bonus`; a fish counts toward ≤1 pair. Communities `{members[3]}`: all three in one car → `communityBonus` output and `communityAppeal` appeal for the car; community also counts its pairs. Decor `bondBonusPP` (Captain's Wheel +0.2) adds to each active bond in that car.

## Frenzy, Sights, Shiny
- Frenzy: tap car → ×`frenzy.mult` for `frenzy.seconds` (`frenzySeconds` decor effect overrides, Brass Diver 15 s), cooldown `frenzy.cooldown`.
- Sights: one at a time, next after seeded uniform in `config.sightInterval` (÷ `sightFrequencyMult` with Brass Bell). Each `sights.json` entry has `durationSeconds` (null = until next arrival), `effects` (`fishIncomeMult`, `fareMult`, `nextArrivalFareMult`), `tapReward` (`fishIncomeSeconds`, `freeFish`), `missPenalty` (`loseShellsFraction`).
- Shiny: each purchase `shinyChance` → appeal × `shinyAppealMult`.

## Depot Reset
Available when runShells ≥ `depotReset.minRunShells` and any terminal reached. Tickets = `floor(sqrt(runShells / divisor))`, divisor = `lines[].ticketDivisor` of the run's Line (fallback `depotReset.divisor`) (T-20). Upgrades (`upgrades.json`, each once, cost in Tickets) carry typed `effects`. Lines open via `lines[].opensAfter` once that Line's terminal was reached in `lines[].opensAfterRuns` runs (default 1; T-20 uses 2 → Line 1, Line 1, Line 2, Line 2, Line 3 = 4 resets).

## Offline
`offline.rate × (fishSps + avgFarePerArrival / legCycleSeconds) × min(elapsed, offline.capHours h)`; Season Pass replaces with rate 0.7 / cap 12 h.

## Today's Special
Price ≈ `todaysSpecial.priceSecondsOfIncome` × current income/s. Level discount `levelDiscount` for `levelDiscountCount` levels. Requests refresh after `request.refreshVisits` visits (request content: T-03).

## Content data notes
- `plants.json`: 20 sprites `<habitat>_<n>`. Four are the listed decor plants (`decorId`: reef_1↔sea_fan, reef_3↔seagrass_tuft, kelp_1↔kelp_strand, vent_1↔tube_garden); decor.json values are authoritative and mirrored. Unlisted plants: +1 appeal, cap 1, cost 120 (L1) / 8e5 (L2) / 2e11 (L3). Sway `{freq, amp}` feeds the plant shader: kelp tall+slow, grasses quick+short, corals/sponges near zero.
- Assumptions not in SPEC: Stowaway tap window 8 s; Whale Breach "all income ×2" = fish and fares; line palette hexes; cosmetic names/hexes; backdrop v=0 is the habitat default.

## Tuning knobs (E1)
Species `baseCost`/`basePps`/`appeal` (±40% allowed, log changes) · `lines[].trackBase`, `fareMult` · `config.carriageBase/Growth`, `slotCostFactor/Growth` · `copyCostGrowth`, `levelCostGrowth`, `milestones` · `fareAppealFactor`, `fareAppealHalf`, `stationMults` (fare share 25–50%) · pair `bonus`, `communityBonus` (bond-never gap) · `frenzy.*` · `sightInterval` · `depotReset.*`, `lines[].ticketDivisor`, `lines[].opensAfterRuns`, `ticketIncomePerTicket` (reset count 3–6) · upgrade `cost`s · `offline.*` (offline target 15–35%) · `todaysSpecial.*`.
