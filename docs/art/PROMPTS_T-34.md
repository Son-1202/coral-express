# T-34 prompt log: Depot Reset scene art + app icon

**Date:** 2026-11-25 · **Full prompt texts:** `docs/art/tools/t34_prompts.cjs` (STYLE BLOCK verbatim + D-021 "style only" line + isolated-sprite line).
Reference: style bible job `174186f2-…` on shed/pool/buffer/yard_A/icon_A/icon_B; none on yard_B and icon_C (T-31 learning); icon_D used **icon_A's job** as reference.

## Credits
| Item | Count | Unit | Cost |
|---|---|---|---|
| gpt_image_2_6 2k medium | 9 | 1.75 | 15.75 |
| nano_banana_pro 2k 21:9 (served as nano_banana_2) | 1 | 2 | 2 |
| **Total T-34** | | | **17.75 / 25** |

Balance 433.79 → 416.04 (verified with `balance`).

## Jobs
| Asset | Job id | Result |
|---|---|---|
| shed A (brick, slate roof, green doors) | `233e72d6-0955-4f5d-90cf-62a409664fdc` | alt → `assets/depot/shed_alt.png` |
| shed B (cream clapboard, seafoam barrel roof) | `fbb03d2f-2ee7-4720-9009-76e37016774b` | **KEPT** → `depot/shed.png` (matches train palette best) |
| pool | `a8d3d93b-5a9c-493d-81a0-712364327578` | **KEPT** → `depot/pool.png` |
| buffer | `7518d8e8-1a84-4e8a-a822-cb8f5e6ce0e8` | **KEPT** → `depot/buffer.png` (buffers face left) |
| yard A (nano, ref) | `dd604d7c-9093-4520-b1b3-9e9aa4eabd47` | rejected: crates/drums clipped by the top edge |
| yard B (gpt 21:9, no ref, grey above crates) | `14914023-9ca7-4860-ab62-9bedf85c70a8` | **KEPT** → `depot/yard.png` |
| icon A (side carriage, small fish) | `44b71316-33eb-4999-8d82-65424fa2bc56` | rejected: fish too small at 60/32 px |
| icon B (loco + carriage 3/4) | `d078596b-20d8-4bef-ac57-1764320b4952` | rejected: busy, fish tiny |
| icon C (rounded tank carriage on rail, no ref) | `a878e321-b7d6-4cf1-a1ff-f2225d7fadeb` | rejected: full-bleed, busy at small size |
| icon D (icon A as ref, chunky carriage, HUGE clownfish) | `9bf0e92e-832f-4729-a159-78a0e3ee5dc5` | **KEPT** → master |

## Processing
- `t34_fetch.sh` → `assets/_raw/t34/*.png`.
- `t34_depot.cjs`: grey keyed locally with `t10_keylib` (D-022) → `assets/_cut/depot/{shed,shed_alt,pool,buffer}.png`; yard: grey sky keyed, made seamless with `t31_lib.seamless` (64 px crossfade, period 1927 px), checked by tiling 2×.
- `t34_pixel.ts` (npx tsx): project pixelizer `scripts/pixelize.ts#pixelizeFile`, 48 colours, explicit sizes (no `depot` group exists in `scripts/lib/groups.ts`):
  shed 640×376 (doorway ≈188×196 px, loco is 320×151 so it fits under the arch), shed_alt 640×395, pool 640×212, buffer 111×80.
- `t34_icons.cjs`: master = icon_D shrunk to 86 % and centred on a gradient sampled from its own edge columns (feathered, seamless) → all important content within the central ~80 %; Lanczos resizes to 180/192/512; maskable 512 = master at 80 % + edge-gradient padding (opaque); favicon-32 = tight crop of the full-bleed carriage; favicon-16 = crop of the glass window + clownfish (whole carriage is mush at 16 px); `favicon.ico` = PNG-in-ICO (16+32); `manifest.webmanifest` as specified.
- `t34_mock.cjs` mock composite; `t34_contact.cjs` → `docs/art/candidates/T-34_contact.jpg` (all candidates, mock, icon at 180/60/32 + favicons on dark/light, maskable in a circle).

## Decisions
- **Backdrops (item 5) skipped**: mock composites with `scenery/l1_far`, `l2_far`, `l3_far` behind the shed + yard read well on all three Lines (`docs/art/candidates/T-34_mock_l1.png`). DEV uses the current Line's `l<n>_far`.
- `yard.png` is opaque from the crate bases down; **transparent above the crates/drums** (so the far backdrop shows behind them). 1927×646 px painterly (not pixelized); in the mock it was drawn at 0.34× (≈655×220) so crates match the loco scale. Sleepers of the second siding are in the middle band; the main rails are drawn in code in front.
- Shed doorway faces the camera (side view of the building); the train can stop in front of / partly inside the dark arch (draw the train in front of the shed).
