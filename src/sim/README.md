# src/sim — Coral Express game rules (T-05)

Pure, deterministic TypeScript. No DOM / Three / window / wall clock / `Math.random`
(enforced by `tests/unit/sim/misc.test.ts`). All numbers come from an injected
`GameData` (`loadGameData()` from `src/data/schema.ts`); the sim never imports JSON.

```ts
import { loadGameData } from '../data/schema';
import { createSim } from './sim';            // or from 'src/sim' (index.ts)
const sim = createSim(loadGameData(), { seed: 123 });          // new game
const sim2 = createSim(data, { seed: 0, save, now: Date.now() }); // load
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
| `serialize(now?)` | `{version, savedAt, state}`. **`now` param added** (wall-clock ms → `savedAt`, default `null`) so output stays deterministic. |

Extension points for T-06/T-07 (exported from `index.ts`):
- `createSimInternal(data, opts)` → `{ sim, ctx, systems }`. `ctx` (`ctx.ts`) holds data index, state, `emit`, cached `fx()` (upgrade effects) and `model()` (income model). **Call `ctx.invalidate()` after mutating fish/cars/decor/upgrades/tickets/endless**, or `ctx.refreshBonds()` to also emit `bondFormed`/`bondBroken`.
- `systems.push((ctx, dt) => …)` runs every tick after income + train (sights, requests).
- New actions: add a variant to `Action` in `types.ts` and a checker to `ACTIONS` in `actions.ts` (the table type forces it).
- `startRun(ctx, line)` (`state.ts`) = run reset used by Depot Reset; keeps Heritage car (habitat, decor, cosmetics), clears its fish and extra slots; Mascot placement left to T-06 (`spawnFish(ctx, species, carId, {level, shiny})` + `fish.mascot = true`).
- `state.modifiers` `{kind: fishIncomeMult | fareMult | nextArrivalFareMult, value, until}`: applied every tick / at arrival; `until: null` = consumed by the next arrival.
- `speciesAvailable()` (`actionsFish.ts`) and `decorAvailable()` (`actionsCar.ts`) are the single places to extend for markets.

## Files
`types.ts` state/actions/events · `rng.ts` mulberry32 (state in `state.rngState`) · `lookup.ts` data index · `costs.ts` formulas · `upgrades.ts` upgrade effects + ticketMult · `bonds.ts` bond matching · `income.ts` per-car model · `train.ts` shuttle/arrivals/fares/stamps/terminals · `state.ts` initial state + `startRun` · `actionCheck.ts`, `actionsFish.ts`, `actionsCar.ts`, `actions.ts` · `save.ts` version + migration · `sim.ts` `createSim`.

## Rule interpretations (not fully pinned down by SPEC — flag to PM/CONTENT if wrong)
1. **Community bonus applies to every fish in the carriage** ("+100% output … for the carriage"), not only the three members; each distinct community counts once per car. Pairs inside it still count.
2. **Pair matching**: pairs in `bonds.json` order, fish in slot order; leftover fish of a pair species is listed as a possible bond only if the partner species is absent from the car.
3. **Whale**: `1 + 0.05 × distinctSpeciesOnTrain` applied once per whale *species* (extra whales don't stack). Distinct count includes the whale.
4. **Fishmonger −25%** applies to fish purchases only, not level-ups.
5. **Heritage carriage (n = 1)** uses the carriage formula too (`400 × 5^-1 × fareMult = 80`), so its habitat change costs 16 and its first extra slot 40 on Line 1.
6. **copiesOwned** = copies currently owned (selling lowers the next price). First Pebble Damsel is free once per run (only if none bought this run).
7. **Frenzy cooldown** 30 s counts from the tap (not from the end of the frenzy). Brass Diver: frenzy lasts `max(10, 15)` s.
8. **Old Friend** +25% applies to all fish output (global), via `permanent.oldFriend`.
9. **Habitats on a line** = that line's plus all earlier lines' (riding Line 1 after opening Line 2 still only offers Reef/Mangrove).
10. **Decor availability** (until T-06 markets): any purchasable decor/plant whose pool line ≤ current line. Plain plant sprites (`plants.json` without `decorId`) are buyable/placeable decor. Decor price grows with copies *bought* this run.
11. **Start**: train stands at Station 1 (counts as arrival for market/stamp/postcard, no fare), departs after `stopSeconds`. First arrival at Station 2 at t = 51 s.
12. Station 1's stamp+postcard events are queued on new-game creation. Postcard event has `suppressToast: true` for the final terminal (l3s6, D-011).
13. Terminal events fire once per run (`terminalReached.firstTime` = first ever for that line). Last line (`maxLine`) first time → `ending` + `permanent.endless` (fares × `endless.fareMult`).
14. Heritage decor after a reset may exceed its (reset) capacity; only new placements are capacity-checked.

## Events
`purchase{item: fish|carriage|slot|decor|habitat}` · `levelUp` · `milestone` · `sale` · `fishMoved` · `bondFormed`/`bondBroken` · `frenzy`/`frenzyEnd` · `depart` · `arrive` · `fare` · `trackBuilt` · `lineOpened` · `terminalReached` · `stamp{kind: station|species|shiny}` · `postcard` · `ending` · `income` (once per sim second) · `decorChanged` · `cosmeticChanged`.

## Performance
~65 ms per 2 h simulated game (8 cars, 24 fish) under tsx. Per-car income is cached and only recomputed after `invalidate()`.
