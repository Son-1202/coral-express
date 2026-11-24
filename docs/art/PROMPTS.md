# Higgsfield prompt log (ART)

STYLE BLOCK = the block in CLAUDE.md, prepended verbatim to every prompt below.

## T-04 style bible (2026-11-24)
- Balance before: **122 cr**. Balance after: **116 cr** (spent 6 cr, budget 7).
- Quote: `estimate_image_cost` nano_banana_pro, 16:9, 2k = **2 cr/image** (quote ref `quote:iuKXv-nXZMkmZsvmfBOSOg`).
- `get_preferences`: auto_create_project = false → no project/folder used.
- Requested model `nano_banana_pro`; **jobs_wait reported the model as `nano_banana_2`** (server-side alias/routing?). Output 2752×1536 PNG. PM may want to check before bulk runs.

| Cand. | Job id | Model (req → reported) | Params | Cost | Raw file | Preview |
|---|---|---|---|---|---|---|
| A | `4b046351-df8a-4be1-8367-d45f1bd33ad1` | nano_banana_pro → nano_banana_2 | 16:9, 2k | 2 | assets/_raw/style_bible_A.png | docs/art/candidates/style_bible_A.jpg |
| B | `174186f2-e469-421b-a531-b0da32893b7b` | nano_banana_pro → nano_banana_2 | 16:9, 2k | 2 | assets/_raw/style_bible_B.png | docs/art/candidates/style_bible_B.jpg |
| C | `a011ccbf-9114-47bd-8f05-b4b71b763455` | nano_banana_pro → nano_banana_2 | 16:9, 2k | 2 | assets/_raw/style_bible_C.png | docs/art/candidates/style_bible_C.jpg |

### Prompts (after STYLE BLOCK)
**A — high camera, mid-day:** Gameplay view, side-on, camera slightly high looking down, bright mid-day sun. A seafoam-green-and-cream steam locomotive with brass trim and round portholes pulls three glass aquarium carriages to the right along a toy-model railway diorama: first carriage a Reef tank with coral pink and turquoise corals and clownfish, second a Mangrove tank with olive water and tea-brown tangled roots, third a tank with schools of small silver and yellow fish. Behind, clear parallax layers: turquoise sea, pastel cliff houses, lemon trees, striped awnings. Foreground: wooden fence posts and small flowers. Strong tilt-shift blur at top and bottom edges.

**B — low camera, station right:** Gameplay view, side-on, low camera near track height, warm late-morning light. A seafoam-green-and-cream steam locomotive with brass trim pulls three glass aquarium carriages along a toy-model railway diorama: a Reef tank with coral pink and turquoise corals and clownfish, a Mangrove tank with olive water and tea-brown roots, and a tank with small darting fish. On the right edge a small seaside station platform with a striped awning, lamp post and tiny pixel passengers waiting and pointing at the tanks. Behind, parallax layers: turquoise sea, pastel cliff houses, lemon trees, striped awnings. Foreground: fence posts and flowers. Tilt-shift blur top and bottom.

**C — wide coast:** Wide gameplay view, side-on, camera pulled back to show more of the coast, soft afternoon light. A small seafoam-green-and-cream steam locomotive with brass trim pulls three glass aquarium carriages across a toy-model railway diorama: a Reef tank with coral pink and turquoise corals and clownfish, a Mangrove tank with olive water and tea-brown roots, and a tank of small fish. Behind, deep parallax layers: a wide sparkling turquoise sea with tiny sailboats, a curving coastline of pastel cliff houses, lemon trees and striped awnings. Foreground: fence posts and wildflowers. Tilt-shift blur top and bottom.

### ART review notes (PM decides)
- **A:** clean, readable silhouettes, all 3 habitats very clear, strong sea/cliff/lemon layers. Tilt-shift is a hard-edged band (looks like letterboxing), loco faces left while cars trail right (train travels left).
- **B:** best depth and natural tilt-shift falloff, station + passengers, boats, lemon trees; most "HD-2D diorama". Flaw: loco has a nameplate with text ("SEA & STREAM") — fine as a mood reference, but must not be copied into sprites; tanks have rimmed lids.
- **C:** most coast visible, train faces right correctly, but hard blur bands again, a 4th partial carriage cut off at left, train small in frame.
- **Recommendation:** B (strongest overall mood/depth; text plate is ignorable for a reference), A as runner-up for clearest tank readability.

## T-09 Line 1 hero art (2026-11-24)
- Balance at start: 116 cr (account later topped up to plus plan; balance is shared with other agents, so spend below is counted per job from quotes + `transactions`).
- Quotes: nano_banana_pro 2k 21:9 = **2 cr** (`quote:KHl_m8ggH7SUZwMuZ7--YQ`), 16:9 = **2 cr** (`quote:x95ivaC-G035qdUWcgrihA`). `remove_background` (image_background_remover) = **1 cr** per call (seen in `transactions`).
- All requests: model `nano_banana_pro` (reported as `nano_banana_2` again), `resolution: 2k`, `medias: [{value: 174186f2-…(style bible B), role: image_references}]`, STYLE BLOCK first.
- **T-09 spend: 18 images × 2 = 36 cr + 3 background removals × 1 = 3 cr → 39 cr (budget 40).** All other cutouts were keyed locally with sharp (free): `docs/art/tools/key.cjs`.
- **Big lesson:** the style-bible reference *bleeds its whole scene* into isolated-sprite prompts (station A/B, loco B, shell B, fish A, mid A got the village/train painted behind them). Adding "use the reference ONLY for style; do NOT copy its background…" fixed the loco (C) but not the station (B). For future isolated sprites consider dropping the reference or passing a cut-out sprite (e.g. this locomotive) as reference instead.

| # | Asset | Job id | AR | Cost | Raw (`assets/_raw/`) | Verdict |
|---|---|---|---|---|---|---|
| 0 | far A | `e9cf2a48-0722-4634-ae70-5cd75097d42e` | 21:9 | 2 | T09_far_A.png | **KEPT** – painterly sea + headland, matches bible. Not seamless → crossfade fix |
| 1 | far B | `3229fc87-9930-47e4-9878-43017757d1d4` | 21:9 | 2 | T09_far_B.png | reject – hard duplicate strips at both edges |
| 17 | far C (retry: "land only in centre") | `125faa7e-60d1-440f-84ae-2cd9ebbfa057` | 21:9 | 2 | T09_far_C.png | reject – 3 hard-edged panels, lighthouse cute but unusable |
| 2 | mid A | `a98258b5-2341-413e-91d8-bb77c7233417` | 21:9 | 2 | T09_mid_A.png | **KEPT** – best houses/lemon trees/cliff; had track+fence below and ghost village above → cropped + mask rebuilt |
| 3 | mid B | `5f36351d-00cf-4980-8101-bc1607ca16dc` | 21:9 | 2 | T09_mid_B.png | reject – houses duplicated in two stacked rows |
| 4 | near A | `d4f8ff41-bcfd-4064-af13-ee629fd74354` | 21:9 | 2 | T09_near_A.png | **KEPT** – clean flat grey, poles with insulators, flowers |
| 5 | near B | `7801e90a-691f-4917-bb37-7de171243e10` | 21:9 | 2 | T09_near_B.png | reject – fog bleed, poles without crossbars |
| 6 | station A | `1e96d8c9-e1fc-493a-9185-4cb320ffec54` | 16:9 | 2 | T09_station_A.png | superseded placeholder – bleed (train bogies, village), no awning |
| 16 | station B (retry, "reference ONLY for style") | `992cfaa8-c02d-4c81-9124-d6821b3513b8` | 16:9 | 2 | T09_station_B.png | reject – copied the whole style-bible scene |
| 7 | loco A | `e4cca474-eca8-4f99-8966-6d3cac20523e` | 16:9 | 2 | T09_loco_A.png | reject – no chimney/dome, odd cab, bleed |
| 8 | loco B | `0472b3c4-9806-4626-af4d-583a5f585b03` | 16:9 | 2 | T09_loco_B.png | reject – copied style-bible scene |
| 15 | loco C (retry, "reference ONLY for style", chimney+cowcatcher at RIGHT) | `aa7b84c4-6b5e-4a48-b526-a0c4298dd25e` | 16:9 | 2 | T09_loco_C.png | **KEPT** – faces right, chimney, brass dome, porthole, no text |
| 9 | car shell A | `796e3317-d20a-4009-85ac-00c2b6a76c95` | 16:9 | 2 | T09_shell_A.png | **KEPT** – clean flat grey, glass-box tank like the bible's carriages |
| 10 | car shell B | `1ba6522a-a472-47c0-bc4a-84b6adf4c153` | 16:9 | 2 | T09_shell_B.png | runner-up – richer (clerestory roof, side windows, flat-grey window) but fog bleed would need a paid bg removal |
| 11 | interior reef | `bc80141e-2031-457e-83f9-fdbcb261c6c0` | 16:9 | 2 | T09_reef_A.png | **KEPT** as-is |
| 12 | interior mangrove | `2208e927-677a-4e31-835b-c78c8cb31fc4` | 16:9 | 2 | T09_mangrove_A.png | **KEPT** – had a riveted glass frame → cropped inside it (2580×1380) |
| 13 | fish sheet A | `4e3418da-1df9-4349-8a71-0b952d295cac` | 16:9 | 2 | T09_fish_A.png | partial – only top row, bottom half = bible scene; **its Carpet Anemone is kept** (base at bottom, tentacles up) |
| 14 | fish sheet B | `dcebd9bb-c44e-4734-bfed-a5caefcda2bb` | 16:9 | 2 | T09_fish_B.png | **KEPT** – clean 3×2 sheet, all facing right; its anemone looked like an upside-down jellyfish → replaced by A's |
| r1 | bg removal loco C | `bff38d96-9176-449a-bb2c-f062ce403f3c` | – | 1 | T09_loco_C_nobg.png | clean |
| r2 | bg removal mid A | `9064bbe8-f852-4ad4-bbcf-d3dfdc8af482` | – | 1 | T09_mid_A_nobg.png | dropped trees+cliff; used only as part of the mask |
| r3 | bg removal station A | `1317246e-abea-4515-a45c-18a4fc5df890` | – | 1 | T09_station_A_nobg.png | dropped the faint awning |

### Prompts (after STYLE BLOCK; sprite prompts end with the CLAUDE.md sprite suffix)
- **far (0,1):** Seamless horizontally tiling panorama background layer: the left and right edges match perfectly so it repeats without a seam. Wide bright clear sky with soft cumulus clouds, calm sparkling turquoise sea filling the lower part, a few tiny distant sailboats, distant hazy sandstone cliffs and a soft green headland on the horizon, horizon line at 55 percent from the top. No foreground, no buildings, no trees, no railway, no train. Sunny Coast late-morning light.
- **far C (17):** Use the reference image ONLY for style and palette; do NOT copy its town, trees, train or composition. Wide distant seascape background layer for horizontal tiling: … hazy sandstone cliffs with a soft green headland and a small lighthouse sit in the CENTER only; the left and right quarters show ONLY open sea and sky, horizon at the same height on both edges …
- **mid (2,3):** Parallax middle layer for a side-scrolling game: a long horizontal row of pastel cliff houses (pink, cream, mint, butter yellow) with terracotta roofs and striped blue-and-cream awnings, round lemon trees full of yellow lemons between the houses, all standing on one continuous band of sandy rock cliff with a straight flat bottom edge, spanning the full width edge to edge. Side view, flat elevation. Isolated on a plain flat solid light grey background above and below, no sky, no sea, no train, no shadow on the ground.
- **near (4,5):** Foreground parallax strip for a side-scrolling game: a low continuous strip of grass tufts and colorful wildflowers along the bottom, weathered wooden fence posts with rails, two tall wooden telegraph poles with crossbars and glass insulators, spanning the full width edge to edge, side view. Isolated on a plain flat solid light grey background, no sky, no sea, no railway, no train, no shadow on the ground.
- **station (6):** A small Sunny Coast railway station platform: raised stone-and-wood platform with a cream and seafoam striped awning on slim posts, a wooden bench, an ornate brass lamp post, wooden flower boxes with red and yellow flowers, a small blank sign board with no writing. No train, no people. + sprite suffix.
- **station B (16):** "Use the reference image ONLY for pixel-art style, palette and the look of the station; do NOT copy its background, scenery, train, track or composition." + same subject, "scalloped awning on slim brass posts … No train, no rails, no people, no fence, no grass" + sprite suffix ("filling the whole image").
- **loco (7,8):** A small vintage seaside steam locomotive, seafoam green and cream paint, polished brass trim, brass dome and chimney, round porthole windows on the cab, spoked wheels with connecting rods, small cowcatcher at the front, no tender, no carriages, no text, no nameplate, no lettering, no numbers. Full side profile, the front of the locomotive points to the right. + sprite suffix.
- **loco C (15):** reference-ONLY-for-style sentence + "seafoam green boiler and cream cab, polished brass bands, tall black chimney and brass steam dome on top of the boiler, round porthole window in the cab, green spoked driving wheels with silver connecting rods, small brass cowcatcher at the front, no tender, no carriages, no driver, no text… chimney and cowcatcher at the RIGHT end, cab at the left end. No rails, no ground." + sprite suffix.
- **car shell (9,10):** An empty glass aquarium railway carriage: dark iron chassis with two wheel bogies, polished brass riveted frame around one large rectangular glass tank window, seafoam green and cream roof. The tank is completely empty: no water, no fish, no plants, no sand, no rocks; the inside of the tank window is filled with flat solid light grey, exactly the same grey as the background. Full side profile, straight-on elevation, no text. + sprite suffix.
- **reef (11):** Aquarium tank interior backdrop, viewed straight on, filling the frame edge to edge, no glass frame, no tank edges visible. Coral reef habitat: turquoise water getting lighter toward the top, coral-pink and peach rock formations and low soft coral mounds along the back wall, smooth pale sand floor across the bottom fifth, gentle light rays from above. No fish, no creatures, no plants in front, open empty water in the middle.
- **mangrove (12):** same frame text; Mangrove habitat: murky olive-green water, tangled tea-brown mangrove roots hanging and arching along the back wall, dark muddy sand floor across the bottom fifth with a few smooth stones, soft dappled light from above. No fish, no creatures, no plants in front, open empty water in the middle.
- **fish (13,14):** Creature sprite sheet: 3 columns by 2 rows grid, one creature per cell, every creature facing right, side view, all at the same pixel scale, generous empty spacing between cells, no grid lines, no labels, no text, plain flat solid light grey background, no shadows. Top row left to right: Pebble Damsel (small grey-blue damselfish); Carpet Anemone (flat purple and green carpet sea anemone with short tentacles, flat base at the bottom); Clownfish (orange with three white bands outlined in black). Bottom row left to right: Mudskipper (brown speckled mudskipper with bulging eyes on top of its head and arm-like pectoral fins); Pistol Shrimp (orange-red snapping shrimp with one oversized claw); Watchman Goby (bright yellow goby with tiny blue spots).

### Post-processing (all scripts in `docs/art/tools/`)
- `key.cjs` – flood-fill keyer for flat grey backgrounds (`--global` also keys enclosed holes). Used: near A (tol 10, global), fish B (tol 14), anemone crop of fish A (tol 16), shell A (tol 12, global).
- `tile_far.cjs` – far A: right 500 px crossfaded (smoothstep) into the left edge → seamless 2668×1344 (no upscale). Headland dissolves into haze at the wrap; check `docs/art/candidates/T-09_contact.jpg`.
- `mid_fix.cjs` – mid A: rows 838–1035 (cliff band) opaque, above = AI alpha ∪ saturated pixels (trees/lemons), 2× 5×5 majority filter, everything below the cliff (track/fence bleed) cut → 2752×620.
- `shell_fix.cjs` – shell A: window rect x645–2084 y523–963 knocked out (frame kept), rail erased below y 1190 except inside the 4 wheel discs (`WHEELS="745,1165,73;1038,1165,73;1691,1165,73;1984,1165,73"`), trimmed → 768×392.
- `slice_fish.cjs` – 3×2 cell slicing + trim (+4 px pad). Anemone: from fish A (crop 960,180 820×470), keyed, scaled to 560 px wide to match sheet B's scale.
- Loco C cutout trimmed → 768×367. Station A cutout cropped at y 1092 (slab top only; bogie bleed below) → 768×251. Interiors: reef as-is 2752×1536; mangrove cropped to 88,80 2580×1380.
- `contact.cjs` → `docs/art/candidates/T-09_contact.jpg`; per-candidate previews `docs/art/candidates/T-09_<cand>.jpg`.

### Station fix (PM-approved, budget ≤ 8 cr) — spent 4 cr, total T-09 = 43 cr (39 + 4 approved)
Prompt (after STYLE BLOCK): [C only: "Use the reference image ONLY for pixel-art style and palette; do NOT copy its background, scenery, train, track, people or composition."] Draw a single small seaside railway station platform alone, as a game sprite: a raised cream stone platform slab; a large striped blue-and-cream canvas awning ROOF with a scalloped front edge covering the whole platform, held up by four slim brass posts; under the roof a wooden bench, a brass lamp post with a glass lantern, wooden flower boxes with red and yellow flowers, and a round hanging clock with no numbers. No train, no rails, no people, no fence, no grass, no houses, no sea. Single isolated subject, side view, centered, on a plain flat solid light grey background filling the whole image, no shadow on the ground.

| # | Variant | Job id | AR | Cost | Raw | Verdict |
|---|---|---|---|---|---|---|
| 21 | station C, WITH style-bible ref + "reference ONLY" | `1da32b6f-ac4e-4632-8a90-b44f8eb737fa` | 16:9 | 2 | T09_station_C.png | reject – leaked the whole bible scene a 3rd time |
| 22 | station D, NO reference, full STYLE BLOCK | `f49fdb70-dc90-4040-b4c1-f724c9f380c5` | 16:9 | 2 | T09_station_D.png | **KEPT** – blue/cream scalloped awning roof on 4 brass posts, bench, lantern, flower boxes, hanging clock (no numerals), clean flat grey |

Cutout: `key.cjs … 12 --global` (free) + `station_fix.cjs` (restores the lantern glass the global key removed) → `assets/_cut/station/l1.png` 768×402. Palette/pixel density matches loco/shell well.
**Recommendation:** for isolated sprites, skip the style-bible reference — it leaked the scene in 7 of 10 sprite generations.

### Open issues for PM
1. ~~Station placeholder~~ fixed (station D).
2. Far layer horizon sits at ~50 %, not 55 %.
3. Pistol Shrimp reads a bit like a crayfish (long body); acceptable at sprite scale.
