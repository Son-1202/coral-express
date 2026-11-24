# Coral Express — Game Spec (source of truth from the producer)

Config: landscape 16:9 · English · first Depot Reset 15–20 min active play · Grand Terminus ending 60–90 min active play · desktop + mobile landscape.

## B1. Pitch
Idle aquarium game on rails. Player inherits an old seaside train whose carriages are glass aquarium tanks. The train rolls along the coast on its own, stopping at stations where passengers board to admire fish and pay fares; fish earn Shells continuously. Player buys carriages, picks a habitat for each, buys fish at station markets, matches **symbiotic partners**. Laying track opens stations and species. First prestige ("Depot Reset") ~15–20 min; all three Lines to the Grand Terminus 60–90 min active + offline. Wide HD-2D coastal panorama.

## B2. Pillars (ranked)
1. **Every fish has a friend.** Symbiosis pairs/communities are the most valuable decision and readable at a glance: partners linked by a small heart-bubble icon, bonus shown on the car.
2. **A journey worth watching.** Even at full idle the train is going somewhere: coast scrolls in parallax, stations come and go, passengers board, things happen.
3. **Every return pays off.** Always an affordable purchase within ~60 s, generous offline earnings, each Depot Reset visibly speeds the next run.

## B3. Core loop
Minute to minute: Shells tick from fish, arrivals pay fare bursts → shop at station market (new fish, decor, plants, Today's Special) or level fish → arrange fish across carriages (habitat, partners, communities) → Passenger Requests board → tap carriage to feed (Frenzy), tap Sights → Tank View to decorate/watch → buy track, carriages, slots. Repeat.

Run loop: start at Station 1 of a Line with Heritage Carriage + Mascot. Extend track station by station; each new station sells one new species. Reach the Line terminal. Once run earned ≥ 1,000,000 Shells and reached any terminal → **Depot Reset** available: reset Shells, fish, carriages, track; gain **Tickets** → spend on **Depot Upgrades** → start faster run on any opened Line. Line 1 terminal first time → opens Line 2 permanently; Line 2 terminal → Line 3. Line 3 terminal first time → **Grand Terminus** ending → endless mode.

## B4. Systems
### B4.1 Currencies
- **Shells**: soft, reset on Depot Reset.
- **Tickets**: prestige, permanent. Every Ticket ever earned gives +10% global income: `ticketMult = 1 + 0.10 × totalTicketsEarned` (spent or not).
- **Stamps**: permanent collection marks; one per station first visit, one per species first bought (and one per shiny species).

### B4.2 Lines and stations
| Line | Region | Habitats unlocked | fareMult | Opens when |
|---|---|---|---|---|
| 1 | Sunny Coast | Reef, Mangrove | ×1 | start |
| 2 | Fog Fjords | Kelp, Polar | ×25 | Line 1 terminal reached once |
| 3 | Volcano Isles | Vent | ×600 | Line 2 terminal reached once |
- 6 stations per Line. Train shuttles back and forth over track built so far.
- Leg time 45 s (upgrades shorten). Stop 6 s at each station.
- Track extension cost to station k (k=2..6): `trackBase_line × 8^(k-2)`, trackBase = 120 / 3,000,000 / 75,000,000,000.
- Each run starts with **150 Shells** and track to **Station 2 already built** on the chosen Line. First game target: first pair (Clownfish + Carpet Anemone) within ~2 min.
- Habitats of earlier Lines stay available on later Lines.

### B4.3 Carriages
- Run starts with 1 carriage, max 8. Carriage n (n≥2) costs `400 × 5^(n-2) × fareMult_line`.
- Habitat chosen when bought (among unlocked). Change later costs 20% of carriage price.
- 3 fish slots, up to 6. Extra slot cost `0.5 × carriagePrice × 2^(extraSlotsBought)`.
- Decor = free placement. Decor Capacity 6 points (+2 per extra slot bought). Items cost capacity (B5.3), placed anywhere on floor/back wall in Tank View.
- Cosmetics (no income effect): sand color (5), back-wall backdrop (habitat default + 2 unlockable variants per habitat), exterior paint (8 colors, tinted in code).

### B4.4 Fish
- One slot each. First copy costs baseCost; each extra copy `baseCost × 1.5^copiesOwned`.
- Levels 1–50. Level-up cost `baseCost × 1.15^level`. Milestones ×2 output at 10, 25, 50.
- A species is first sold only at its home station market; once bought in this run it can be re-bought/levelled anywhere.
- Drag between carriages anytime. Selling refunds 50% of spend.

### B4.5 Income
```
fishSps   = basePps × level × milestoneMult × habitatMult × bondMult × frenzyMult × ticketMult × upgradeMults
appeal_car = Σ fish appeal × habitatMult + decor appeal + communityAppeal
fare       = (Σ appeal_car) × 8 × stationMult × fareMult_line × ticketMult × upgradeMults   (paid at every arrival)
stationMult (1..6) = 1, 1.4, 2, 2.8, 4, 6
habitatMult = 1.0 home habitat, 0.5 elsewhere
```

### B4.6 Bonds (key feature)
- Pairs: two specific species in the same carriage each get the pair bonus. A fish counts towards at most one pair.
- Communities: three specific species in the same carriage → +100% output and +5 appeal for the carriage. A community also counts its pairs.
- `bondMult = 1 + Σ pair bonuses + community bonus`.
- Shiny: each purchase 1% chance → ×3 appeal, own Stamp, sparkle burst, passenger cheer.
- Readability: heart-bubble floats between partners; pair one fish short shows dotted outline of missing partner; car detail lists active and possible bonds.

### B4.7 Feeding Frenzy
Tap carriage → its fish ×3 output for 10 s. Per-carriage 30 s cooldown shown as a ring on its door. Bots: greedy feeds best carriage every 1 s; random feeds random carriage every 3 s.

### B4.8 Sights (one every 70–110 s seeded; one at a time)
| Sight | Effect | Player action |
|---|---|---|
| Dolphin Race | dolphins race train 8 s | tap: gain 60 s of fish income |
| Seagull Thief | gull on roof 6 s | tap to shoo, else lose 5% current Shells |
| Whale Breach | all income ×2 for 20 s | automatic; camera eases out to show whale |
| Festival Station | next arrival pays ×5 fares | automatic; bunting + confetti |
| Stowaway | random owned-habitat species jumps into a free slot free | tap splash to accept (needs free slot) |
| Sea Fog | fares ×0.5, fish income ×1.5 for 30 s | automatic |

### B4.9 Depot Reset
- Available when `runShells ≥ 1,000,000` and reached any terminal this run.
- Tickets gained `floor(sqrt(runShells / 100,000))` (1M→3, 4M→6, 25M→15).
- Resets Shells, fish, carriages, slots, decor, track. Keeps Tickets, Upgrades, opened Lines, Stamps, Postcards, **Heritage Carriage with its layout**, **Mascot**, unlocked cosmetics, Request history.
- Reset scene: train pulls into Depot, other carriages uncoupled, fish "sent to the depot pools" (shown resting in a pond behind the depot), only Heritage Carriage stays coupled.
- Before each run pick which opened Line to ride. Confirm dialog shows Tickets gained and new global multiplier.

### B4.10 Offline
On load compute elapsed time. Earn 50% of fish income + 50% of average fare rate (fares per arrival ÷ leg cycle time) at save time, cap 8 h. "While you were away" postcard: time away, Shells earned, stations "visited".

### B4.12 Station Markets
- Each arrival opens that station's market (chime, awning unfolds). Market stays open until next arrival. Train never waits.
- **Catalogue** (always, anywhere): every species bought this run, every decor owned, slots, carriages, track.
- 4 stalls per station:
  - **Fish stall**: signature species (first sale only here) + 2 species from earlier stations of this Line. Fixed prices. Signature shows "NEW" ribbon + partner icons.
  - **Decor & plants**: 3 items from this Line's decor pool, rerolled every arrival (seeded). Owned items shown as "restock".
  - **Today's Special**: one offer per arrival: −30% on one owned species' next 10 levels, a **Shiny Egg** (next purchase of a chosen species guaranteed shiny), a free extra fish slot for one carriage, or a cosmetic backdrop/paint. Priced ≈ 2 min current income.
  - **Passenger Requests board**: up to 3 requests.
- 18 stations each: name, stallkeeper sprite (passenger sprite + apron tinted in code), one-line greeting.
- UX: market slides in from right; buy = coin chime + item flies to carriage. Unaffordable shows "in 42 s".

### B4.13 Passenger Requests
- Up to 3 per station; named passenger + portrait + one line. ≥ 30 requests across 3 Lines.
- Types: see a species (3 min income), see a community (5 min income + cosmetic), see a shiny (Shiny Egg), appeal target (4 min income), decoration theme (rare decor item, e.g. Wren's Framed Photo).
- Completed automatically when train next arrives at that station with condition met. Passenger boards, walks to the car, celebrates. New requests after 2 visits.
- E1: greedy completes requests on its path; requests = 5–15% of greedy income.

### B4.14 Heritage Carriage and Mascot
- First carriage = Heritage Carriage (Wren's original). Habitat, decor layout, sand, backdrop, paint survive every reset.
- Before each reset choose one fish as **Mascot**: keeps species, shiny, player-given name (default suggested). Starts next run in Heritage Carriage at **level 5**, ignores habitat penalty, wears a tiny conductor's cap.
- Same Mascot species 3 resets in a row → permanent +25% output ("Old Friend").

### B4.15 Tank View
- Enter: double-tap carriage or `Enter`. Camera dollies into carriage until tank fills screen. Train keeps running: coast drifts past behind back glass, blurred; slosh plays at stations.
- Watch mode: tap fish → camera follows; card with name/nickname (editable), species, level, bonds, output, shiny, flavor line. Tap water → pinch of food fish swim to (cosmetic). Photo mode: hide UI, frame (railway ticket, postcard, polaroid), save PNG; postcard photo can be pinned in Stamp book.
- Decorate mode (pencil): drag decor/plants from bottom tray to floor/back wall; drag to move, pinch/scroll scale 0.8–1.2×, tap to flip, long-press to remove. Capacity meter. Snaps to floor line; two depth bands (front/behind fish). Plants sway; fish route around decor, hide in castles/arches. Sand/backdrop/paint swatches.
- Leave: pinch out, Esc, back button.

### B4.16 Win
No lose state. Win = Line 3 terminal first time → Grand Terminus ending, credits, endless mode with "Undersea Line" bonus: fares ×2 permanently.

## B5. Content tables
### B5.1 Species (CONTENT may tune basePps/baseCost/appeal ±40% to hit E1; log changes)
| id | Name | Habitat | Line·Station | baseCost | basePps | Appeal | Special | motion |
|---|---|---|---|---|---|---|---|---|
| pebble_damsel | Pebble Damsel | Reef | L1·S1 | 10 | 0.5 | 1 | first one free | darter |
| carpet_anemone | Carpet Anemone | Reef | L1·S2 | 80 | 2 | 2 | sessile | sessile |
| clownfish | Clownfish | Reef | L1·S3 | 500 | 9 | 4 | — | darter |
| mudskipper | Mudskipper | Mangrove | L1·S4 | 3,500 | 45 | 3 | hops onto glass | hopper |
| pistol_shrimp | Pistol Shrimp | Mangrove | L1·S5 | 25,000 | 240 | 2 | snap particle when fed | crawler |
| watchman_goby | Watchman Goby | Mangrove | L1·S6 | 180,000 | 1,300 | 5 | — | darter |
| garibaldi | Garibaldi | Kelp | L2·S1 | 4e6 | 25,000 | 5 | — | darter |
| kelp_seahorse | Kelp Seahorse | Kelp | L2·S2 | 2.5e7 | 130,000 | 8 | — | hoverer |
| leafy_seadragon | Leafy Seadragon | Kelp | L2·S3 | 1.6e8 | 700,000 | 12 | — | hoverer |
| ice_krill | Ice Krill Swarm | Polar | L2·S4 | 1.0e9 | 3.6e6 | 3 | counts as 2 fish for appeal | swarm |
| icefish | Icefish | Polar | L2·S5 | 6.5e9 | 2.0e7 | 7 | — | darter |
| snow_crab | Snow Crab | Polar | L2·S6 | 4.0e10 | 1.1e8 | 6 | — | crawler |
| tubeworm | Tubeworm Bloom | Vent | L3·S1 | 1.5e12 | 3.5e9 | 5 | sessile | sessile |
| yeti_crab | Yeti Crab | Vent | L3·S2 | 1.0e13 | 2.0e10 | 7 | — | crawler |
| scaly_snail | Scaly-foot Snail | Vent | L3·S3 | 6.5e13 | 1.1e11 | 6 | — | crawler |
| vent_octopus | Vent Octopus | Vent | L3·S4 | 4.0e14 | 6.0e11 | 10 | — | pulser |
| ghost_ray | Ghost Ray | Vent | L3·S5 | 2.5e15 | 3.2e12 | 12 | — | glider |
| pocket_whale | Pocket Whale | any | L3·S6 | 1.6e16 | 1.6e13 | 25 | always home habitat; +5% to all fish per distinct species on train | glider (+sinuous tail) |

### B5.2 Bonds
Pairs (bonus each): Clownfish+Carpet Anemone +50% · Pistol Shrimp+Watchman Goby +50% · Garibaldi+Kelp Seahorse +40% · Ice Krill+Icefish +50% · Tubeworm+Yeti Crab +50% · Vent Octopus+Scaly-foot Snail +40%.
Communities (same carriage, all three): Reef Family (Pebble Damsel+Carpet Anemone+Clownfish) · Mangrove Crew (Mudskipper+Pistol Shrimp+Watchman Goby) · Kelp Court (Garibaldi+Kelp Seahorse+Leafy Seadragon) · Ice Floe (Ice Krill+Icefish+Snow Crab) · Vent Choir (Tubeworm+Yeti Crab+Scaly-foot Snail).

### B5.3 Decor & plants (free placement; capacity per carriage; cost ×3 per extra copy owned; same-id bonuses don't stack in one car, appeal does)
| id | Name | Pool | Base cost | Cap | Effect |
|---|---|---|---|---|---|
| sea_glass | Sea-Glass Pebbles | L1 | 150 | 1 | +2 appeal |
| seagrass_tuft | Seagrass Tuft (plant) | L1 | 200 | 1 | +1 appeal; quick sway |
| sea_fan | Pink Sea Fan (plant) | L1 | 900 | 1 | +2 appeal |
| treasure_chest | Bubbling Chest | L1 | 2,000 | 2 | +5 appeal; fish in car +10% |
| mangrove_root | Driftwood Root | L1 | 6,000 | 2 | +4 appeal; Mangrove fish here +10% |
| coral_castle | Coral Castle | L1 | 40,000 | 3 | +10 appeal; fish hide inside |
| kelp_strand | Giant Kelp Strand (plant) | L2 | 1.5e6 | 1 | +3 appeal; tall slow sway |
| sunken_rowboat | Sunken Rowboat | L2 | 8e6 | 3 | +12 appeal |
| ice_arch | Ice Arch | L2 | 4e7 | 2 | +10 appeal; Polar fish here +10% |
| brass_diver | Brass Diver Statue | L2 | 9e7 | 2 | +15 appeal; Frenzy here lasts 15 s |
| tube_garden | Tubeworm Garden (plant) | L3 | 5e11 | 1 | +6 appeal |
| basalt_pillars | Basalt Pillars | L3 | 3e12 | 2 | +14 appeal; Vent fish here +10% |
| captains_wheel | Captain's Wheel | L3 | 2e13 | 3 | +25 appeal; bonds in car +20 pp |
| wren_photo | Wren's Framed Photo | Request reward | — | 1 | +5 appeal; memento |
All 20 plant sprites are available as decor; unlisted plants give +1 appeal.

### B5.4 Depot Upgrades (Tickets; each bought once)
| id | Name | Cost | Effect |
|---|---|---|---|
| season_pass | Season Pass | 2 | offline cap 8h→12h, rate 50%→70% |
| spare_change | Spare Change | 2 | runs start with 500 × totalTicketsEarned Shells |
| express_engine | Express Engine | 3 | leg 45 s→30 s |
| fishmonger | Fishmonger's Favor | 3 | species costs −25% |
| double_decker | Double Decker | 4 | carriages start with 5 slots |
| brass_bell | Brass Bell | 4 | Sights 50% more often |
| ticket_printer | Ticket Printer | 5 | fares ×2 |
| matchmaker | Matchmaker | 6 | pair bonus +25 pp; communities +50 pp |

## B6. Story
Tone cozy, gentle, wistful picture-book seaside road trip. Player inherits the Coral Express from **Grandma Wren Halloway**, retired ship's cook who built it so people far from the sea could meet its creatures. **Postcards** at every station: 18 (≤40 words each) on first visit, + a note on first Depot Reset and on opening each Line; toast announces each. Arc: Wren hints the line was never meant to end at the last station — "taking them home one day." Twist at Line 3 terminal: Grand Terminus has no platform; tracks run down the beach and continue **under the sea**; train rolls into the water, glass opens, fish swim free among wild cousins, then return to the train by choice. Ending (~6 lines): train slows on black-sand beach, Wren's final postcard, dive, wide underwater panorama with every owned species, "The End… of the line?", credits. Line budget ≤35 total (postcards, notes, ending, tips). Separate: stamp flavor 18×≤20 words; station names+greetings 18×1 line; ≥30 Requests. Tutorial ≤5 contextual tips (buy first fish, make first pair, feed a carriage, open Tank View and place a plant, check Requests board); never block input > one tap.

## B7. Screens
Title (key art, logo, Continue/New Game/Settings; Continue shows time away) · Train view HUD (side view in diorama; drag/scroll to pan; top bar Shells, Shells/s, Tickets, next-station progress + ETA; bottom bar Market·Track·Stamps·Depot; tap car = feed; long-press / "i" tab = car detail) · Car detail side panel (habitat, slots, fish list with level ×1/×10/Max, active+possible bonds, decor capacity, change habitat, Open Tank View) · Tank View full screen · Market side panel (4 stalls + stallkeeper + greeting, Catalogue; cost, Shells/s, habitat, partner icons, "affordable in N s") · Mascot picker · Track map · Stamp book · Depot (reset + ticket preview, upgrades, Line picker, lifetime stats) · Offline popup · Ending + credits · Settings (music/SFX vol, quality Auto/High/Low, number format short/scientific, reset save double-confirm).
Panels slide from right, ≤40% width. Portrait phones → "rotate your phone" card with looping mini train. Numbers: 1.2K, 3.4M, 5.6B, 7.8T, 9.1Qa, scientific from 1e18.

## B8. Controls
Touch/mouse: tap car feed; long-press/right-click car detail; drag fish between cars; drag/scroll pan; tap Sights; double-tap car Tank View; Tank View: tap fish follow, tap water food, drag decor from tray.
Keyboard: ←/→ pan cars; 1–8 jump; M/T/S/D panels; Space feeds best car; Enter Tank View; E decorate; P photo; Esc close/leave.

## B9. Art direction
HD-2D: crisp pixel sprites in painterly 3D dioramas, tilt-shift miniature depth, soft bloom, fog, particles — toy railway model.
Train: vintage seaside train seafoam green + cream, brass trim, round portholes, wooden benches, riveted glass tank walls. Interiors: Reef (coral pink, turquoise), Mangrove (olive, tea-brown roots), Kelp (deep green, golden fronds), Polar (ice blue, white), Vent (charcoal, rust orange, jade minerals).
Line 1 Sunny Coast: pastel cliff houses, lemon trees, striped awnings, turquoise sea. Line 2 Fog Fjords: slate-blue mountains, pine forests, red wooden boathouses, low mist. Line 3 Volcano Isles: black-sand beaches, jade lagoons, smoking volcano far off, palm silhouettes.
Time of day drifts morning→afternoon→dusk→night on 6-min cycle, pure color grade.

## B11. Audio
Procedural WebAudio: bubble pops on purchase, coin chime pitch rising with amount, soft splash feeding, station bell, wheel clack tied to speed, UI clicks, milestone fanfare. Generated music (if budget): main accordion+ukulele travel loop; per-Line variants (mandolin / fiddle+choir / steel drum+marimba); ambience per Line; calm Depot theme; whale song; ending theme. Crossfade between Lines, duck during ending.

## C. Tech (summary — see CLAUDE.md for rules)
- `src/sim` pure deterministic seeded; events; `advance(seconds)` tick-invariant within 0.1% (600 s once vs 2400×0.25 s); `advanceOffline(seconds)` per B4.10; tab hidden or frame gap > 5 s = offline time; JS doubles; single `formatNumber()`; autosave localStorage every 10 s, on reset, on `pagehide`; save `version` + migration.
- Diorama: long side-on world: far (sky/sea/mountains), mid (cliffs/houses), track (train/stations), near (fences/poles/flowers) as textured planes at different Z; perspective camera narrow FOV slight down tilt; true parallax; camera follows selected carriage with easing + small sway. Each tank renders habitat interior behind glass with subtle refraction/ripple shader.
- Sprites: billboards, NearestFilter, 1px outline. No sprite-sheet animation; procedural: fish wander inside tank with tail-wobble vertex shader, turn by mirroring with squash, wiggle when fed, flash white + sparkles on level-up; sessile sway; passengers bob; train rocks on rail joints.
- Motion profiles (`src/render/anim/`): darter (boids-lite, bursts, tail wobble freq ∝ speed), hoverer (slow bob, fin flutter, curls around plant), glider (long arcs, body undulation), sinuous (sine head→tail), crawler (floor-locked short hops, claw-snap squash), hopper (hops, sticks to glass), pulser (squash-stretch jet, tentacle wave), swarm (40–80 instanced particles flocking), sessile (anchored, tentacles sway).
- Fish depth: random Z; farther = smaller, bluer, softer. Never overlap glass frame.
- Tanks layered: static backdrop + separate plant sprites front and behind fish. Plant sway vertex shader `offsetX = sin(time×freq + worldX×0.7) × amp × uv.y²`, per-habitat freq/amp; plants bend away 0.5 s when a fish passes.
- Water: wobbling surface line, caustics on sand, bubble streams from air stone, drifting particles.
- **Signature motion:** when train brakes/pulls away, tank contents tilt and slosh ~1 s (surface tilts, plants lean, fish drift), then settle.
- Scenery: wave shader on sea; near-layer foliage sways; clouds drift; distant gull flocks boids; volcano smoke; Fjord fog banks; props and wildlife tween in/out.
- Train: wheels rotate with speed; rods move; steam puffs rate ∝ speed; carriages rock at rail joints with front→back delay.
- Passengers walk with bob/lean, stop at glass, point, cheer (jump+squash) at shinies and bonds.
- `/?debug=zoo`: every species, every habitat's plants, every Sight in a grid.
- Shading: per-region mood grade driven by time of day, station lamp point lights at dusk/night, thicker fog on Fjords.
- Post-FX: tilt-shift DoF, soft bloom, vignette, subtle grain, per-region grade. Quality toggle auto-drops to Low if FPS < 45 for 3 s.
- UI: fontsource "Pixelify Sans" headings, "Silkscreen" numbers; 9-slice panels like old railway tickets + brass plates; touch targets ≥ 44 px.
- Persistence localStorage only.
- `window.__debug`: `seed`, `skipTo('line2'|'line3'|'depotReset'|'terminal'|'ending')`, `forceWin()`, `runBot(name)`, `addShells(n)`, `fastForward(seconds)`, `triggerSight(id)`, `simulateOffline(seconds)`, `setTimeOfDay('morning'|'afternoon'|'dusk'|'night')`.

## E1. Headless balance (`scripts/balance.ts`, ≥ 5,000 seeded games per bot, 120 sim-min active play or until Grand Terminus)
Bots:
- **random**: every 3 s random affordable action (buy fish, level, carriage, slot, decor, track, move fish, Depot Reset when available 50%); feed random car every 3 s; taps 50% of Sights.
- **greedy**: best "Shells/s gained per Shell spent" action (counting fare income/s); places fish to complete pairs/communities in right habitat; feeds once/s; taps every Sight; Depot Reset when projected Tickets ≥ 2× current total (≥3 first run); buys upgrades in table order; rides newest opened Line; buys Today's Special when payback beats best action; completes Requests on its path; highest-level fish as Mascot.
- **bond-never**: greedy but places fish by raw output+habitat only, never forms bonds deliberately, spreads species randomly.
Targets:
| Metric | Target |
|---|---|
| Greedy time to first Depot Reset | 15–20 min |
| Random time to first Depot Reset | 35–70 min (or not within 120 min in ≤20% runs) |
| Greedy time to Grand Terminus (active) | 60–90 min |
| Greedy with one 8 h offline break at min 30 | Terminus 15–35% sooner |
| Bond-never time to Terminus | ≥30% slower than greedy (or not reached in 120 min) |
| Bond-never avg income at min 15 run 1 | ≤75% of greedy |
| First game time to first pair (greedy) | ≤2.5 min |
| Share of greedy income from Requests | 5–15% |
| Gap between meaningful goals min 5–15 each run (greedy) | never > 3 min |
| Fares vs fish (greedy, session avg) | fares 25–50% of total |
| Dominance: any single species share at each reset (greedy) | ≤35% |
| Every species bought before Terminus (greedy) | ≥90% of runs per species |
| Dead time after min 1 (greedy) | ≤90 s |
| Depot Resets before Terminus (greedy) | 3–6 |
Write results to `docs/qa/balance_report.md`.
