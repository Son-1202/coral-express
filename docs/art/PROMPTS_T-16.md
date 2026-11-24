# T-16 prompt log: time-of-day far layers, tank backdrops, Wren, key art, postcards, line covers, shiny fish

**Date:** 2026-11-24 · **Model:** `nano_banana_pro`, `resolution: 2k` (jobs report `nano_banana_2`, as in T-04/T-09/T-10). Role `image_references`.
**Prompt =** the STYLE BLOCK (CLAUDE.md, verbatim) + the text described below. Every non-train asset adds the D-021/D-022 line ("SCENERY/BACKDROP/PORTRAIT ONLY, the reference image is only for painting style ... no train").

## Credits
| Item | Count | Unit | Cost |
|---|---|---|---|
| nano_banana_pro 2k (21:9 / 16:9 / 3:2 / 1:1) | 54 (48 first pass + 6 retries) | 2 cr | **108** |
| remove_background | 0 | | 0 |
| **Total T-16** | | | **108 / 130** |

Quote `quote:jxpHaz8W13SFSo-bVXWHdw` (21:9 2k + 2 refs = 2 cr). Balance before 665.54, after 546.29. The account is shared with T-12/T-09 runs at the same time, so the difference (119.25) is more than T-16's spend. The 108 is counted from T-16's own job ids below.

## References
- Style bible job `174186f2-e469-421b-a531-b0da32893b7b` (style only, D-021 wording).
- Time-of-day: the base far layer was passed by its **original generation job id** instead of re-uploading the cut file (same image, before tiling): l1 `e9cf2a48-…` (T09 far A), l2 `6616bf89-…`, l3 `bc2d2e60-…`. Prompt: "Repaint the second reference image: the same … panorama with the same composition, the same horizon height, … repainted at <MORNING: soft pink dawn … | DUSK: golden-orange … | NIGHT: deep blue moonlit, stars, round pale moon, silvery moonlight path>".
- Backdrops: the matching interior job as the 2nd reference (reef `bc80141e`, mangrove `2208e927`, kelp `a20e6e50`, polar `1e8f883d`, vent `d842c4a1`) + "Inside of an aquarium tank, straight-on flat front view like the second reference image, the water fills the entire frame edge to edge, no glass frame … Empty stage: no fish, no creatures, nothing in the foreground".
- Shiny fish: only the original sheet job (L1 `dcebd9bb`, L2 `6f2dc877`, L3 `cbd33075`), no style bible. "Recolor the reference creature sprite sheet: the exact same six creatures in the exact same 3 by 2 grid positions … rare SHINY variant: iridescent pearly pastel gold with soft pink, mint and lavender rainbow sheen".
- Title C / Ending C: the kept locomotive cut-out job `aa7b84c4` as reference (no bible) → no "SEA & STREAM" plate text.

## Jobs
| # | Asset | Job id | Result |
|---|---|---|---|
| 0 | l1_far_morning | `db3af259-adc7-4bef-ace2-44f3ee271be4` | **KEPT** → scenery/l1_far_morning.png |
| 1 | l1_far_dusk | `c16beec4-565e-4160-979f-7da817736946` | **KEPT** → scenery/l1_far_dusk.png |
| 2 | l1_far_night | `c6bb4bf5-c463-4ec6-a1dc-76837957338b` | **KEPT** → scenery/l1_far_night.png |
| 3 | l2_far_morning | `3bfba756-7fc9-4aeb-b7a7-2d7690864544` | **KEPT** → scenery/l2_far_morning.png |
| 4 | l2_far_dusk | `273c8128-cfd9-4062-adf7-fddc4218956e` | **KEPT** → scenery/l2_far_dusk.png |
| 5 | l2_far_night | `f164bbb2-d5d5-4ed9-bce6-8ced8fbce9d0` | **KEPT** → scenery/l2_far_night.png |
| 6 | l3_far_morning | `373b40e7-6e3b-4de4-b45e-dfc935337888` | **KEPT** → scenery/l3_far_morning.png |
| 7 | l3_far_dusk | `15ab09fa-fc7f-45ab-94e5-0363a49149fd` | **KEPT** → scenery/l3_far_dusk.png |
| 8 | l3_far_night | `3d4e96eb-8541-4fc3-8072-03c3674a2789` | **KEPT** → scenery/l3_far_night.png |
| 9 | shiny_l1 | `e735ae17-16a6-441d-919b-c3c3b697489b` | rejected: only damsel + anemone recoloured, mudskipper/goby/shrimp kept normal colours |
| 10 | shiny_l2 | `01b9ae3d-2ae6-491a-80ec-c23b4e7bd605` | **KEPT** → 6 L2 *_shiny sprites |
| 11 | shiny_l3 | `8d64bf7d-d608-42a5-89fc-27d68c09f60a` | **KEPT** → 6 L3 *_shiny sprites (TOL=36 SAT=20, inset 45) |
| 12 | backdrop_reef_1 | `11a1b2e2-56d6-48b7-b018-a1f9d2179d32` | **KEPT** → train/backdrop_reef_1.png |
| 13 | backdrop_reef_2 | `edc84e87-b363-472c-b33a-544f23800c7c` | **KEPT** → train/backdrop_reef_2.png |
| 14 | backdrop_mangrove_1 | `6553121d-b5c3-4f12-9ac9-f66b85112307` | **KEPT** → train/backdrop_mangrove_1.png |
| 15 | backdrop_mangrove_2 | `b3954930-4005-49a0-a1fd-c556e9ab8d5f` | **KEPT** → train/backdrop_mangrove_2.png |
| 16 | backdrop_kelp_1 | `3af15dca-9902-4fed-9ac2-fbc257fc4d74` | **KEPT** → train/backdrop_kelp_1.png |
| 17 | backdrop_kelp_2 | `5ef1b19e-0a1b-46e0-aa2b-062cec550b75` | **KEPT** → train/backdrop_kelp_2.png |
| 18 | backdrop_polar_1 | `0bc60d4d-0e04-4f12-b25d-4e5bf8f7d14a` | **KEPT** → train/backdrop_polar_1.png |
| 19 | backdrop_polar_2 | `f4e89dd9-ae3e-4f3c-8d19-df834f510d0c` | rejected: pink brick box, not ice |
| 20 | backdrop_vent_1 | `a442168a-4720-442c-985a-a3dc8b425409` | **KEPT** → train/backdrop_vent_1.png |
| 21 | backdrop_vent_2 | `ac626908-236c-47a3-9055-390f5014acae` | rejected: second water band under the floor |
| 22 | wren_portrait | `608172f7-f697-4614-9ef7-e07b46abe94b` | **KEPT** → ui/wren_portrait.png |
| 23 | title_A | `6b7d7001-25a4-41cc-a5bd-feae93847048` | candidate (not shipped): near-copy of the style bible |
| 24 | postcard_l1s1 | `1347be90-f6dc-474d-a900-d551d9b2d530` | **KEPT** → ui/postcard_l1s1.png |
| 25 | postcard_l1s2 | `ba6a1ebf-2e95-45ce-8f8f-1c76c194abaa` | **KEPT** → ui/postcard_l1s2.png |
| 26 | postcard_l1s3 | `2eea4437-4c6a-40b5-8664-26a81312f1c1` | **KEPT** → ui/postcard_l1s3.png |
| 27 | postcard_l1s4 | `952f1db9-fa1f-4434-b5b9-f7833733fd0d` | **KEPT** → ui/postcard_l1s4.png |
| 28 | postcard_l1s5 | `2417c07d-db72-479a-84c1-46bb43284bf4` | **KEPT** → ui/postcard_l1s5.png |
| 29 | postcard_l1s6 | `1f043c02-60d5-4ea7-ba66-b75a7394b4e0` | **KEPT** → ui/postcard_l1s6.png |
| 30 | postcard_l2s1 | `55985a4f-d548-4691-8e7f-1e90b91d4e08` | **KEPT** (cream border painted in → cropped 64,48 2400×1600) |
| 31 | postcard_l2s2 | `6ac201d3-18e6-4eed-8dd0-8ebac0df491a` | **KEPT** → ui/postcard_l2s2.png |
| 32 | postcard_l2s3 | `35059b21-4caa-4401-84c0-a9307b7e3f26` | **KEPT** → ui/postcard_l2s3.png |
| 33 | postcard_l2s4 | `ead34f6c-1610-4ccc-a91c-2aad2c3ddff3` | **KEPT** → ui/postcard_l2s4.png |
| 34 | postcard_l2s5 | `96ce161c-e72e-46c1-8765-d1e1741a8415` | **KEPT** → ui/postcard_l2s5.png |
| 35 | postcard_l2s6 | `0c13f6fc-9879-4db3-8ca3-18f8c5d2efda` | **KEPT** → ui/postcard_l2s6.png |
| 36 | postcard_l3s1 | `0bbf023f-acf4-46f6-b679-c4f45c989bee` | **KEPT** → ui/postcard_l3s1.png |
| 37 | postcard_l3s2 | `8be26b9d-fcfe-402d-8a50-0c532af5b2bd` | **KEPT** → ui/postcard_l3s2.png |
| 38 | postcard_l3s3 | `5ec7d19b-031a-40a2-b61c-4dcfe08a5d23` | **KEPT** → ui/postcard_l3s3.png |
| 39 | postcard_l3s4 | `82a4c7ca-8b7b-436a-bb5e-252a3ff28849` | **KEPT** → ui/postcard_l3s4.png |
| 40 | postcard_l3s5 | `1836a894-0b7c-4aab-b82b-3fc97134038e` | **KEPT** → ui/postcard_l3s5.png |
| 41 | postcard_l3s6 | `7d225932-0acc-432b-94db-72031c12df88` | rejected: rails run along the beach, not into the sea |
| 42 | line_cover_1 | `2e4f6952-91ee-43ad-8b8a-d49ff7d6639b` | **KEPT** → ui/line_cover_1.png |
| 43 | line_cover_2 | `66d350a2-1d72-40c7-8c8a-acc16ce01048` | **KEPT** → ui/line_cover_2.png |
| 44 | line_cover_3 | `3c92f2fd-4ab2-4b13-84bb-ea2a85eb7009` | **KEPT** → ui/line_cover_3.png |
| 45 | title_B | `6dd2a327-547d-4709-936c-7bef47f5ca1d` | candidate (not shipped): copies bible, "SEA & STREAM" plate text |
| 46 | ending_A | `1c040f81-7f01-48ab-90ab-34978842a851` | candidate (not shipped): "SEA & STREAM" plate text |
| 47 | ending_B | `0363d180-21c5-4f70-8bff-8d9479856b41` | candidate (2nd choice): small plate text, glass open |
| 48 | shiny_l1_r1 | `3c94aa5f-9c90-435e-9275-f17cb9e30376` | **KEPT** → 6 L1 *_shiny sprites (anemone flipped vertically, scaled to 560 px like the original) |
| 49 | backdrop_polar_2_r1 | `c63230ec-12ab-475f-b865-485386299863` | **KEPT** → train/backdrop_polar_2.png |
| 50 | backdrop_vent_2_r1 | `5aff3a6b-d345-4895-8966-e12cb2d5a833` | **KEPT** → train/backdrop_vent_2.png (dark side walls visible, like vent_1) |
| 51 | title_C | `19fb4e33-01cf-493b-b12a-09c4f46a7ece` | **KEPT** → ui/title_keyart.png (calm sky upper half; train heads left) |
| 52 | postcard_l3s6_r1 | `90faba4a-b875-4570-89cc-cd94c094dc51` | **KEPT** → ui/postcard_l3s6.png |
| 53 | ending_C | `60fb7b79-9da4-469e-9b76-8b3347ebd27d` | **KEPT** → ui/ending_keyart.png |

## Subject texts (after the STYLE BLOCK + exclusion line)
- **Backdrops:** reef_1 Reef Dawn (coral-pink rock wall, warm coral-orange sunrise rays) · reef_2 Reef Dusk (deep teal twilight, violet) · mangrove_1 dawn (peach-gold dappled rays) · mangrove_2 dusk (teal-green, firefly specks) · kelp_1 Kelp Cathedral (golden kelp arches like a nave, sun shafts) · kelp_2 dusk (mossy stone wall, dark kelp silhouettes, amber-violet) · polar_1 Polar Aurora (ice block wall, green aurora through ice ceiling) · polar_2 r1 (glacier ice + icicles tinted rose/apricot/lilac by polar sunset) · vent_1 Ember Glow (basalt wall, glowing lava cracks, embers) · vent_2 r1 Jade Crystal Cave (glowing jade/mint crystals, one sand floor at the bottom edge).
- **Wren:** head-and-shoulders portrait, white hair bun, rosy cheeks, navy cook's jacket with brass buttons, gold anchor brooch, blurred turquoise sea behind, three-quarter view facing right.
- **Postcards:** "Vintage illustrated travel postcard picture, full-bleed illustration with NO border, NO frame, NO lettering, NO stamp, NO writing" + one scene per `postcards.json` text: l1s1 halt in lemon groves with one damselfish jar · l1s2 wet steps into an anemone rock pool · l1s3 cove with parasols, split view clownfish in anemone · l1s4 mangrove cape, mudskippers on roots · l1s5 fishing pier, split view shrimp digging + goby on watch · l1s6 lighthouse beam pointing out to open sea · l2s1 Grimsvik quay, garibaldi glowing like lanterns · l2s2 islet cottage over kelp forest with seahorses · l2s3 red-white lighthouse, hidden leafy seadragon · l2s4 ravens over a river of pink krill · l2s5 glacier night, icefish under the ice, one lit cabin · l2s6 Kaldhavn harbour, smoke plume on the southern horizon · l3s1 outrigger landing, tubeworm vent garden below · l3s2 pumice shore, floating stones, yeti crab · l3s3 lava meeting the sea, scaly-foot snail · l3s4 islet hut, octopus watching the sunset · l3s5 obsidian shore at twilight, ghost rays under glassy water · l3s6 r1 view from behind the track: rails cross a black-sand beach and run into the sea toward a turquoise glow, violet misty dawn.
- **Line covers:** wide panorama, "The train is SMALL in the frame": L1 stone viaduct over the Sunny Coast · L2 fjord shore with red boathouses · L3 causeway across a volcano lagoon.
- **Title:** train at a striped-awning seaside platform at golden hour, passengers waving, everything in the lower 40 %, upper-middle third calm sky for the logo.
- **Ending:** train on rails across the seabed, carriage glass swung open, its fish joining wild schools, rays, turtles, a small whale, sunbeams from the surface.

## Processing (scripts in `docs/art/tools/t16_*`, run from repo root)
- `t16_fetch.sh <name> <url>` → `assets/_raw/t16/<name>.png` + preview.
- Far layers: l1 with `tile_far.cjs <in> <out> 500 2752` (same as T-09 → 2668×1344), l2/l3 with `t10_tile.cjs <in> <out> 192 2752` (same as T-10 → 2752×1243). Seams checked: invisible.
- `t16_finish.cjs`: backdrops → 2752×1536 (same as interiors); postcards → 1536×1024; line covers / key art → 1920×1080; Wren → 1024×1024. It also crops l2s1's painted border.
- Shiny: `t10_slice.cjs` (L1/L2 inset 14 default tol; L3 inset 45 `TOL=36 SAT=20`) into scratch, renamed to `<id>_shiny.png`. The L1 anemone was flipped vertically (tentacles up, like the kept original) and scaled to 560 px wide. Sprite sizes match the originals within a few px.
- `t16_contact.cjs` → `docs/art/candidates/T-16_contact.jpg` + `T-16_{title,ending}_{A,B,C}.jpg`.

## Known nits
- Kelp_2 / vent_1 / vent_2 backdrops show faint dark tank side walls at the edges (the base interiors have them too). DEV can crop ~5 % per side if needed.
- l3s4 postcard: the octopus sits on a riveted metal tub (a wink at the train's tank latches). Kept.
- title_keyart: the train faces left. ending_B (candidate) is the alternative if PM wants plate-free art facing differently. Its plate text is tiny.
- Output PNGs are heavy (postcards ~3 MB, backdrops 5–8 MB). DEV may want webp/jpg conversion at build time.
- L1 far variants: the left headland from the base became open sea (the right cliffs are kept). The horizon height matches.
