# T-10 prompt log: Lines 2–3 scenery, stations, Kelp/Polar/Vent interiors, fish L2 + L3

**Date:** 2026-11-24 · **Model:** `nano_banana_pro`, `resolution: 2k` (jobs report `nano_banana_2`, same as T-04) · **Reference:** every request passes style bible job `174186f2-e469-421b-a531-b0da32893b7b` as `image_references`.
**Prompt =** the STYLE BLOCK from CLAUDE.md (verbatim) + ". " + the text below. Full prompt texts for batch 1 are also in `docs/art/tools/t10_prompts.json`.

## Credits
| Item | Count | Unit | Cost |
|---|---|---|---|
| nano_banana_pro 2k (21:9 / 16:9 / 3:2) | 26 | 2 cr | 52 |
| image_background_remover | 5 | 1 cr | 5 |
| **Total T-10** | | | **57 / 70** |

- Quote: `estimate_image_cost` nano_banana_pro 21:9 2k + reference = 2 cr (`quote:99Tim778zcrOIKX8npsm_Q`). Background removal = 1 cr (checked in `transactions`).
- Balance before: **970** · after: **682.54**. The account is shared with T-09, which ran at the same time, so the balance difference (≈287) is not T-10's spend. The 57 above is counted from T-10's own job ids. One extra remover charge at 05:51:26 may be T-10's (a call that returned a rate-limit error); if it was, the worst case is 58.

## Big finding: the style-bible reference leaks its composition
With the style bible as reference, **9 of the 12 first-pass scenery images, and the first L2 station, painted the train from the reference** (or a blurred copy of the reference scene behind the subject). The STYLE BLOCK's "vintage seaside train with glass aquarium carriages" makes this worse. The fix that worked was to add this line right after the STYLE BLOCK: **"SCENERY ONLY / BUILDING ONLY, the reference image is only for painting style: absolutely no train, no locomotive, no carriages, no railway tracks, no people"**. Recommend the PM add it to ASSET_LIST guidance for every non-train asset.

## Background removal: mostly done locally (free)
`remove_background` (Higgsfield) was **unreliable on bands and sheets**. It made L3-near foliage semi-transparent, dropped the krill and pocket whale from the sheets, and left pink fringes on the seadragon. It was **clean on single buildings** (both stations). For the bands and fish I used a local keyer instead, `docs/art/tools/t10_keylib.cjs`. It flood-fills the flat grey from the borders, also clears enclosed grey pockets, and adds a 1px soft fringe. The four sheet/band remover outputs (paid) are kept in `assets/_raw/t10/*_nobg.png` but are not used.

## Jobs
| # | Asset | Job id | Result | Notes |
|---|---|---|---|---|
| 0 | l2_far A | `6616bf89-5d4d-485d-aff0-3fb418c837c7` | **KEPT** → `scenery/l2_far.png` | varied ridge line, even horizon, tiles well |
| 1 | l2_far B | `87603042-2c8c-441d-841c-e234eb1c6c06` | rejected | symmetric V-valley focal point, poor for tiling |
| 2 | l2_mid A | `b527c36b-88db-40bb-9a6b-3678b3e741c7` | rejected | train painted in |
| 3 | l2_mid B | `fd8b3dd0-1fe4-4388-86a9-e64956af4b32` | rejected | train ×2 + water |
| 21 | l2_mid retry 1 | `7870d187-3a73-4a8c-aee0-a8e95481dcbd` | **KEPT** → `scenery/l2_mid.png` | ghost train under the grass was cropped off (rows 380–925); the jetty was not drawn |
| 4 | l2_near A | `402f6d3b-ae5a-4db5-bce4-d93352739622` | rejected (usable) | band fine, smaller than B |
| 5 | l2_near B | `6f01a101-5d21-4dcc-af62-686e0f02410e` | **KEPT** → `scenery/l2_near.png` | train above the band; cropped rows 1030–1344 |
| 6 | l3_far A | `bc2d2e60-9e5e-4332-aeb2-d2f29a5b4a48` | **KEPT** → `scenery/l3_far.png` | flat horizon, tiles well |
| 7 | l3_far B | `e95e9971-5459-4746-b8de-3815b9c85d23` | rejected | islands framing both edges |
| 8 | l3_mid A | `2cafa159-e7a8-4f8a-9d38-6eefce555a8e` | rejected | train + station painted in |
| 9 | l3_mid B | `3b637580-a352-40c5-ada4-73a5704c72a5` | rejected | train painted in |
| 22 | l3_mid retry 1 | `5b882a00-5554-4f14-a052-36ab4f41617e` | **KEPT** → `scenery/l3_mid.png` | hazy grey background palms kept as atmosphere |
| 10 | l3_near A | `5c508932-3012-4586-bb0e-503eeae7fcf4` | rejected | reference-scene blur behind the leaves; remover output `a3dd35b6-…` unusable |
| 11 | l3_near B | `1da5c906-94c1-40f5-a50e-cb2935f4c435` | rejected | train painted in |
| 24 | l3_near retry 1 | `37fc04a5-f145-468c-91b9-facaa0c4c9c1` | **KEPT** → `scenery/l3_near.png` | cropped rows 680–1344 |
| 12 | station l2 | `aecfe706-1d19-4d7f-a9a1-27b6832795f5` | rejected | drew the train, no station |
| 25 | station l2 retry 1 | `44c6f929-4d1a-417e-a968-3d7be70acd2f` | **KEPT** → `station/l2.png` | remover `f21f9ff1-29fe-4c86-82b1-7bbba351ff36` was clean |
| 13 | station l3 | `f2d98332-5558-4674-ac36-338036f13c6b` | **KEPT** → `station/l3.png` | remover `beb3be6f-7d14-4efc-99e6-44524c842f28`; 3/4 view with a short rail stub under the platform |
| 14 | interior kelp | `e02de38f-8bb5-4141-a7d5-36af4149cf23` | rejected | kelp fronds in the foreground (the ticket says no front plants) |
| 23 | interior kelp retry 1 | `a20e6e50-d59c-4cc0-bba3-581eb242b1c5` | **KEPT** → `train/interior_kelp.png` | light shafts, mossy stone wall, sand |
| 15 | interior polar | `1e8f883d-fd30-415f-b959-aeb8f68912c5` | **KEPT** → `train/interior_polar.png` | |
| 16 | interior vent | `d842c4a1-c8c4-48a3-b403-b11a6b1a799c` | **KEPT** → `train/interior_vent.png` | tank side walls cropped off (5.5% per side), rescaled to 2752×1536 |
| 17 | fish L2 A | `91f9e6b2-7bbb-4f92-8496-fdd2cd69a484` | rejected | smaller and less detailed sprites |
| 18 | fish L2 B | `6f2dc877-6fc6-494a-a761-88bea8e1ce15` | **KEPT** → 6 sprites | larger and crisper; grid lines removed by the cell inset |
| 19 | fish L3 A | `cbd33075-942a-4bf7-9272-c8545104a4d7` | **KEPT** → 6 sprites | crisper, ray and whale clearly face right |
| 20 | fish L3 B | `249e1f4a-5be7-4038-a048-bd57da12bebf` | rejected | close second |
| — | remover tests | `8bb011d8-…` (L2 sheet), `4bf04326-…` (L3 sheet) | not used | dropped subjects; local keyer used instead |

## Retry prompts (text after the STYLE BLOCK)
- **l2_mid r1:** SCENERY ONLY, the reference image is only for painting style: absolutely no train, no locomotive, no carriages, no railway tracks, no people, no station. Middle parallax layer strip for a side-scrolling game, Fog Fjords: one long continuous horizontal band of dark green pine forest growing on a grassy hill strip, with three small red wooden boathouses with white trim spaced along it and one little wooden jetty, spanning the full width edge to edge. Above the treetops and below the grass strip: plain flat solid light grey background, no sky, no water, no mountains. Side view, no shadow on the ground, even edges for horizontal tiling.
- **l3_mid r1:** the same header, then: Volcano Isles: one long continuous horizontal band of black lava rocks and black sand mounds with tall leaning palm trees in dark green silhouettes and two small thatched stilt huts on wooden legs spaced along it, spanning the full width edge to edge. Above the palms and below the rock band: plain flat solid light grey background, no sky, no water. Side view, no shadow on the ground, even edges for horizontal tiling.
- **l3_near r1:** the same header (+ no houses, no blurred background scenery), then: Foreground parallax layer strip, Volcano Isles: one low continuous horizontal band along the bottom third, full width, of lush tropical ferns, broad monstera leaves, red hibiscus flowers and short bamboo posts tied with rope. Everything above the plants is a plain flat solid uniform light grey background, completely empty. Side view, no shadow on the ground, even edges for horizontal tiling.
- **interior_kelp r1:** Inside of an aquarium tank, straight-on flat front view, the water fills the entire frame edge to edge, no glass frame, no tank walls visible: Kelp habitat backdrop, deep green water, soft golden sunlight shafts slanting down from the surface, a flat rocky back wall of mossy grey-green stones across the whole width, sandy floor along the bottom. Empty stage for later sprites: NO kelp, NO seaweed, NO plants anywhere, no fish, no animals, nothing in the foreground, only water, light rays, back wall and sand floor.
- **station_l2 r1:** BUILDING ONLY, the reference image is only for painting style: absolutely no train, no locomotive, no carriages, no rails, no people. Subject: a small Nordic countryside railway station building with its platform: a red-painted wooden plank hut with white window frames and white corner trim, a steep pitched roof dusted with white snow, a black iron lantern glowing warm amber hanging from a bracket, a wooden bench on a raised wooden plank platform in front. Single isolated subject, side view, centered, on a plain flat solid light grey background, no shadow on the ground.
- First-pass prompts for stations, interiors and fish sheets follow the same pattern. The fish sheet text was: "Game sprite sheet: a 3 by 2 grid of six separate sea creatures, one per cell with generous empty space between them, all at the same scale, all in side view facing RIGHT, on a plain flat solid light grey background, no shadows, no labels, no grid lines. Top row left to right: … Bottom row left to right: …"

## Processing (all scripts in `docs/art/tools/t10_*`, run from repo root with node)
- `t10_fetch.sh`: download a job result to `assets/_raw/t10/` and make a preview.
- `t10_band.cjs`: crop a band and key the grey (bg = median of the band's top row). Used with tol 30 / sat 18 for the mid layers and l3_near, 22/14 for l2_near.
- `t10_tile.cjs`: seamless far layers (192px right→left cross-fade), output 2752 wide.
- `t10_tilecut.cjs`: seamless alpha bands. It finds the best-matching column pair near each edge, crops between them and does a 24px fade, which avoids ghosting. Cuts: l2_mid 92–3084, l3_mid 180–3100, l2_near 344–2856 (→2512 wide), l3_near 312–3016 (→2704 wide).
- `t10_slice.cjs`: slices a 3×2 sheet → keyed, trimmed sprites, max 768 px long side. L2: inset 14, default tolerance. L3: inset 45, `TOL=36 SAT=20` (noisy two-tone cell backgrounds).
- `t10_contact.cjs` → `docs/art/candidates/T-10_contact.jpg`. `t10_grid.cjs` / `t10_stack.cjs` make review previews.

## Outputs
- `assets/_cut/scenery/l2_far.png` 2752×1243 (opaque), `l2_mid.png` 2752×449, `l2_near.png` 2512×314, `l3_far.png` 2752×1243 (opaque), `l3_mid.png` 2752×816, `l3_near.png` 2704×547. Mid and near layers have alpha.
- `assets/_cut/station/l2.png` 768×688, `l3.png` 768×532 (alpha).
- `assets/_cut/train/interior_kelp.png`, `interior_polar.png`, `interior_vent.png` 2752×1536.
- `assets/_cut/fish/`: garibaldi, kelp_seahorse, leafy_seadragon, ice_krill, icefish, snow_crab, tubeworm, yeti_crab, scaly_snail, vent_octopus, ghost_ray, pocket_whale (.png, alpha, ≤768 px).

## Known nits (PM / DEV may ignore)
- l3_mid: a small stray palm fragment near the tile seam (left edge). Hazy grey background palms are opaque-ish grey, not alpha haze.
- l3_near: two bamboo posts sit close together at the seam.
- station/l3 is a 3/4 view and includes a short rail stub under the platform; station/l2 has slightly soft tilt-shift edges on the left roof. The L1 station (T-09) is 768×251, so the L2/L3 stations are taller. Scale them in the manifest.
- vent_octopus faces the viewer (a dumbo pose). The pulser motion makes facing irrelevant.
