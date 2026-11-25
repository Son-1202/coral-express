# src/sim — Coral Express game rules (T-05 core + T-06 meta)

Pure, deterministic TypeScript. No DOM / Three / window / wall clock / `Math.random`
(enforced by `tests/unit/sim/misc.test.ts`). All numbers come from an injected
`GameData` (`loadGameData()` from `src/data/schema.ts`); the sim never imports JSON.

```ts
import { loadGameData } from '../data/schema';
import { createSim } from './sim';            // or from 'src/sim' (index.ts)
const sim = createSim(loadGameData(), { seed: 123 });          // new game
const sim2 = createSim(data, { seed: 0, save, now: Date.now(), story }); // load
// story = { requests } from src/story/requests.json (cast to StoryData); omit → no requests.
// save may be SaveData, its JSON string or junk (→ fresh game). With save.savedAt + now,
// offline time is applied once on load → sim.offlineReport (and an `offline` event).
```

## API (as in the ticket, plus the deltas below)
| Member | Notes |
|---|---|
| `state` | Live `SimState` (plain JSON object, see `types.ts`). Treat it as read-only outside the sim. |
| `advance(s)` | Fixed 0.25 s ticks; the remainder is kept in `state.tickAcc` (so it is saved too). Exactly tick-invariant: any chunking gives the same tick sequence. Ignores `s ≤ 0` and NaN. |
| `act(a)` / `price(a)` | Both use the same checker (`actions.ts`), so price and purchase always agree. `price` → cost, `0` for free actions, **negative = refund** (`sellFish`), `null` = not possible right now (ignores affordability). `act` → `{ok:false, reason:'cantAfford'}` when short of Shells. |
| `drainEvents()` | Events since the last drain, in order. |
| `stats()` | `{fishSps, farePerArrival, fareSps, totalSps, nextFare}`. `farePerArrival` = average over one full shuttle cycle of the built track; `fareSps = farePerArrival / (leg + stop)` (offline uses this). **`nextFare` added**: what the next arrival pays right now. |
| `carInfo(id)` | income, appeal, active bonds, possible bonds (`missing` species), per-fish `{sps, habitatMult, bondMult, appeal}`, slots used/total, decor used/capacity, `frenzyActive`, `frenzyReadyIn`. Throws on unknown id. |
| `serialize(now?)` | `{version: 1, savedAt, state}`. **`now` param added** (wall-clock ms → `savedAt`, default `null`) so output stays deterministic. |
| `advanceOffline(s)` | T-06. Cap 8 h (Season Pass 12 h), rate 50% (70%) × (base fish Sps + base fare rate) × t; frenzy/Sight buffs ignored and expired; train position untouched. Returns `{seconds, shells, stationsVisited}`. |
| `canDepotReset()` / `projectedTickets()` | T-06. runShells ≥ `depotReset.minRunShells` and a terminal reached this run; `floor(sqrt(runShells / divisor))`, divisor = current Line's `ticketDivisor` (T-20) or `depotReset.divisor`; at least 1 once runShells ≥ `minRunShells` (T-33). `depotPreview()` (T-33): checklist, grant, income ×before/after, next-Ticket threshold for the Depot panel. |
| `triggerSight(id)` | T-06 debug hook (`window.__debug.triggerSight`). |
| `offlineReport` | Offline result applied by `createSim({save, now})`, else `null`. |
| `migrateSave(raw, seed?)` | (exported) SaveData / JSON string / bare v0 state → current SaveData; junk → fresh blank state; missing fields filled from defaults; newer version **throws**. |

### T-06 actions
| Action | Notes |
|---|---|
| `tapSight{}` | Taps the active tap-Sight. `noSight`, `invalid` (auto sight), `noSlot` (Stowaway). |
| `buySpecial{target?}` | Today's Special. `target` = species (Shiny Egg: Catalogue or the stall's signature species) or car id (free slot). `soldOut` after one purchase. |
| `buyUpgrade{id}` | Costs **Tickets**: `price()` reports 0 Shells; `cantAfford` when short of Tickets, `owned` if bought. |
| `depotReset{mascotFishId, mascotName?, nextLine}` | `notReady`, `unknownFish`, `locked` (line not opened). The only way to choose a line. |
`acceptRequest` was not added: every request on a board is active (ticket's "simplest" option).

### T-06 state (`types.ts`)
`sight {active, nextAt}` · `market {station, stationId, fish[], decor[], special, requests[]}` · `requestBoards[stationId] {ids, visits}` · `levelDiscounts[species]` · `shinyEggs {any, species[]}` · `speciesShells[species]` (this run) · `lifetime` + `sightShells, requestShells, offlineShells, offlineSeconds, sightLosses, requestsCompleted` · `requestsDoneThisRun` · `permanent.requestHistory` (unique ids) + `permanent.requestCounts[id]`.

Extension points for T-06/T-07 (exported from `index.ts`):
- `createSimInternal(data, opts)` → `{ sim, ctx, systems }`. `ctx` (`ctx.ts`) holds data index, state, `emit`, cached `fx()` (upgrade effects) and `model()` (income model). **Call `ctx.invalidate()` after mutating fish/cars/decor/upgrades/tickets/endless**, or `ctx.refreshBonds()` to also emit `bondFormed`/`bondBroken`.
- `systems.push((ctx, dt) => …)` runs every tick after income + train (sights, requests).
- New actions: add a variant to `Action` in `types.ts` and a checker to `ACTIONS` in `actions.ts` (the table type forces it).
- `startRun(ctx, line)` (`state.ts`) = run reset used by Depot Reset; keeps Heritage car (habitat, decor, cosmetics), clears its fish and extra slots, request boards, level discounts, per-species stats (Shiny Eggs kept). `placeMascot(ctx)` (`depot.ts`) adds the Mascot.
- `systems` starts with `sightSystem`. `rates.ts` has the shared income helpers (`baseIncome`, `fareAt`, …).
- `state.modifiers` `{kind: fishIncomeMult | fareMult | nextArrivalFareMult, value, until}`: applied every tick / at arrival; `until: null` = consumed by the next arrival.
- `speciesAvailable()` = bought this run or on the open fish stall; `decorAvailable()` = on the decor stall or already owned (restock).

## Files
`types.ts` state/actions/events · `story.ts` request types · `rates.ts` income helpers · `sights.ts` · `market.ts` (stalls + Today's Special) · `requests.ts` · `depot.ts` (reset, mascot, upgrades) · `offline.ts` · `rng.ts` mulberry32 (state in `state.rngState`) · `lookup.ts` data index · `costs.ts` formulas · `upgrades.ts` upgrade effects + ticketMult · `bonds.ts` bond matching · `income.ts` per-car model · `train.ts` shuttle/arrivals/fares/stamps/terminals · `state.ts` initial state + `startRun` · `actionCheck.ts`, `actionsFish.ts`, `actionsCar.ts`, `actions.ts` · `save.ts` version + migration · `sim.ts` `createSim`.

## Rule interpretations (not fully pinned down by SPEC — flag to PM/CONTENT if wrong)
1. **Community bonus (D-018)** applies only to the three member fish (first fish of each member species in slot order); +5 appeal for the car; each distinct community counts once per car. Pairs inside it still count.
2. **Pair matching**: pairs in `bonds.json` order, fish in slot order; leftover fish of a pair species is listed as a possible bond only if the partner species is absent from the car.
3. **Whale**: `1 + 0.05 × distinctSpeciesOnTrain` applied once per whale *species* (extra whales don't stack). Distinct count includes the whale.
4. **Fishmonger −25%** applies to fish purchases only, not level-ups (D-018 accepted this; T-06 rule 3 says "buy + level" — PM please confirm).
5. **Heritage carriage (n = 1)** uses the carriage formula too (`400 × 5^-1 × fareMult = 80`), so its habitat change costs 16 and its first extra slot 40 on Line 1.
6. **copiesOwned** = copies currently owned (selling lowers the next price). First Pebble Damsel is free once per run (only if none bought this run).
7. **Frenzy cooldown** 30 s counts from the tap (not from the end of the frenzy). Brass Diver: frenzy lasts `max(10, 15)` s.
8. **Old Friend** +25% applies to all fish output (global), via `permanent.oldFriend`.
9. **Habitats on a line** = that line's plus all earlier lines' (riding Line 1 after opening Line 2 still only offers Reef/Mangrove).
10. **Decor availability**: decor stall or owned copies (see T-06). Plain plant sprites (`plants.json` without `decorId`) are buyable/placeable decor and count as plants for requests. Decor price grows with copies *bought* this run.
11. **Start**: train stands at Station 1 (counts as arrival for market/stamp/postcard, no fare), departs after `stopSeconds`. First arrival at Station 2 at t = 51 s.
12. Station 1's stamp+postcard events are queued on new-game creation. Postcard event has `suppressToast: true` for the final terminal (l3s6, D-011).
13. Terminal events fire once per run (`terminalReached.firstTime` = first ever for that line). Last line (`maxLine`) first time → `ending` + `permanent.endless` (fares × `endless.fareMult`).
14. Heritage decor after a reset may exceed its (reset) capacity; only new placements are capacity-checked.

### T-06 interpretations (flag to PM/CONTENT if wrong)
15. **Sight schedule**: next start = previous start + U(70,110) ÷ sightFrequencyMult; deferred while a Sight is still active (Festival can last until the next arrival). Uniform pick among `sights.json`. First Sight is drawn on the first tick.
16. **Whale Breach** doubles fish *and* fares (data, D-012). Festival ends when its next-arrival modifier is consumed.
17. **"N seconds of income"** (Dolphin = fish only; requests = fish + fare rate; Today's Special price; offline) uses *base* rates without frenzy/Sight buffs, so buffs can't be stacked into rewards.
18. **Stowaway**: species whose habitat matches an owned carriage (or `any`) and is bought this run or sold on this line's built track; goes to a free slot of a matching-habitat car, else the first free slot. Free (spent 0), still rolls shiny, raises copy price.
19. **Fish stall**: signature species + signatures of the two *previous* stations (fixed, not random). Decor stall: 3 distinct seeded picks from the line's purchasable decor + plants, rerolled each visit.
20. **Today's Special**: rolled each visit among eligible kinds (shiny egg always; level discount if a species is owned; free slot if a car is below max; cosmetic = a still-locked unlockable **backdrop** — paints are all free in T-05). Price fixed at market open: max(`config.todaysSpecial.minPrice` (optional; fallback `SPECIAL_MIN_PRICE` = 50), 120 × base income/s). Level discount is per species (shared by its fish), −30% for the next 10 levels. Free slot also counts as an extra slot (decor capacity, next slot price).
21. **Shiny Eggs**: Today's Special egg is species-specific; the request reward egg (`shinyEgg`) makes the next fish purchase of any species shiny. Eggs survive Depot Reset.
22. **Requests**: board = up to 3 ids, station-specific first then line-wide (file order), skipping ids completed this run (`requestsDoneThisRun`, cleared by Depot Reset, so later runs offer them again) or on another board; a request completes at most once per run. `permanent.requestHistory` / `requestCounts` keep the lifetime record. All are active. Checked on each real arrival at that station (not at run start). Board rebuilt when it has been through 2 visits (3rd arrival) or emptied; rebuild prefers ids not on the previous board. Conditions: species / shiny = any car; community = car with it active; appeal = one car's appeal ≥ value; decor = all items in one car (`plantAny` counts plant decor + plant sprites). Rewards: income seconds × base income; cosmetic id → `unlockedCosmetics`; decor → one owned copy (tray). Shells go to `lifetime.requestShells`.
23. **Depot Reset**: Mascot streak +1 if same species as the previous Mascot else 1; `oldFriend` latches at 3. The Mascot spawns at level 5 in Heritage, keeps shiny + name, `mascot: true`, counts as an owned copy (it is in the Catalogue). Active Sight ends silently.
24. **Double Decker** also raises existing carriages to 5 slots when bought.
25. **Save**: `migrateSave` fills missing keys from `blankState` recursively (wrong-typed values replaced); v0 = top-level `tickets/totalTicketsEarned/upgrades/stamps/postcards/openedLines` moved to `permanent`. On load, fish of unknown species and decor of unknown ids are dropped; a missing market is rebuilt.

### T-20 rule changes (balance tuning; see docs/content/TUNING.md)
26. **Fares scale with fish output** (data alone could not reach fares 25–50%: appeal is O(10) while fish output spans 13 orders of magnitude). Fare at station k = Σ_car `fareAppeal(appeal_car)` × car base fish Sps × `fareAppealFactor` × stationMult(k) × Ticket Printer × endless (× timed fare modifiers). Car base Sps already holds Tickets, bonds, habitat, decor, whale, Old Friend; `lines[].fareMult` now only prices carriages. `fareAppeal(A)` = A·H/(A+H) with `config.fareAppealHalf` = H (saturating; absent → linear A). `TrainModel.fareWeight` = Σ fareAppeal(A)·Sps. An empty car pays nothing.
27. **Lines open after N terminal runs**: `lines[].opensAfterRuns` (default 1). `permanent.terminalRuns[line]` counts runs that reached that terminal (once per run); `terminalReached.firstTime` and `reachedTerminals` keep their meaning; the ending still fires on the first `maxLine` terminal.
28. **Per-Line Ticket divisor**: `lines[].ticketDivisor` (optional) replaces `depotReset.divisor` for runs on that Line. T-33: an eligible reset (≥ `minRunShells` + terminal this run) grants `max(1, …)` Tickets, so the gate the player sees is the real gate.
29. `config.todaysSpecial.minPrice` is now in the schema (D-023).

## Events
`purchase{item: fish|carriage|slot|decor|habitat}` · `levelUp` · `milestone` · `sale` · `fishMoved` · `bondFormed`/`bondBroken` · `frenzy`/`frenzyEnd` · `depart` · `arrive` · `fare` · `trackBuilt` · `lineOpened` · `terminalReached` · `stamp{kind: station|species|shiny}` · `postcard` · `ending` · `income` (once per sim second) · `decorChanged` · `cosmeticChanged`.
T-06: `sightStart{sightId, until, requiresTap}` · `sightEnd{sightId, tapped, shells (±), fishId?}` · `market{station, stationId}` · `specialBought{kind, cost, target?}` · `requestCompleted{requestId, stationId, passenger, carId, shells, rewardType, rewardRef?}` · `upgradeBought{id, tickets}` · `depotReset{tickets, totalTicketsEarned, line, mascotSpecies, oldFriend}` · `offline{seconds, shells, stationsVisited}`.

## Performance
~50–65 ms per 2 h simulated game (8 cars, 24 fish, sights + markets + requests) under tsx. Per-car income is cached and only recomputed after `invalidate()`.
