# T-39 prompt log — kelp & vent backdrops + missing UI icons (ART)

Date 2026-11-26. Budget ≤ 15 cr. **Spent 10 cr** (balance 409.04 → 399.04). No retries needed.

## Jobs (one generate_image_batch)
| # | Name | Job id | Model / params / cost | Result |
|---|---|---|---|---|
| 0 | kelp_a | `240aab0b-bd96-4ca1-ae3c-133494aa574e` | nano_banana_pro (reports nano_banana_2) 16:9 2k, ref style bible, 2 | **KEPT** → `train/interior_kelp` |
| 1 | kelp_b | `95f0490e-c203-43b2-96cf-f1011dce81f4` | same, 2 | rejected: soft painterly, less pixel-crisp than other interiors |
| 2 | vent_a | `1d9c21ff-e037-4f15-ab5c-2750afedbf6a` | same, 2 | rejected: painted a waterline/glass split across the middle |
| 3 | vent_b | `338417c1-7eb3-4997-9a44-945d802057f9` | same, 2 | **KEPT** (cropped) → `train/interior_vent` |
| 4 | icons_1 | `50f76dfd-8870-47f4-bea2-886ad4d27d6b` | gpt_image_2_6 1:1 medium 1k transparent, ref T-12 icons_a `16162fa3-…`, 1 | feed, tankview, special_slot, special_cosmetic |
| 5 | icons_2 | `394d5192-e8b6-4217-81f4-6662617b1c97` | same, 1 | sight_festival, sight_stowaway, sight_seafog (+ unused feed "pinch" alt) |

Style bible ref = `174186f2-e469-421b-a531-b0da32893b7b` (`image_references`).

## Prompts
All = STYLE BLOCK (CLAUDE.md, verbatim) + ". " + text below.
- **Interiors header (D-022):** "SCENERY ONLY, the reference image is only for painting style: no train, no track, do not copy its scene. Inside of an aquarium tank, straight-on flat front view of the tank back wall, the water fills the entire frame edge to edge, no glass frame, no tank walls visible:"
- **kelp_a:** "a bright, readable KELP FOREST backdrop. A rocky back wall of warm grey-brown boulders across the whole width, covered by a dense curtain of tall golden-green and amber kelp fronds rising from the rocks to the water surface, standing flat against the back wall (background layer only, soft and slightly hazy). Bright soft golden sunbeams slanting down from the rippling surface, clear light sea-green water, pale warm sandy floor along the bottom fifth. Mid-tones bright and light (light jade, honey gold, pale sand), low contrast, so that dark and orange fish will read clearly in front. Empty stage: no fish, no animals, nothing in the foreground, no plants in front, no dark areas."
- **kelp_b:** sunny kelp forest in light pastel gouache, far kelp rows fading into aqua haze, mossy rocks, god-rays, cream sand floor; light and airy, no deep shadows.
- **vent_a:** "a hydrothermal VENT habitat backdrop that is LIGHT and HIGH CONTRAST. A back wall of warm charcoal-brown basalt columns with bold cream-lit edges, crusted with bright jade-green and turquoise mineral deposits, several glowing rust-orange vent chimneys … A broad, evenly lit middle band … clearly brighter than the rocks, so grey animals read against it. Warm light ochre and ash sand floor … Overall medium-light values, not dark, not black. Empty stage: no fish, no crabs, no animals, nothing in the foreground."
- **vent_b:** "deep-sea vent garden backdrop in warm gouache. Low warm charcoal basalt ridges along the left and right edges and a low ridge across the back, crusted with jade-green mineral crust, three glowing rust-orange and amber vent mounds with warm light spilling on the rocks. The whole middle of the image is open water lit by a soft warm amber-teal glow, a clearly bright readable band behind where animals will swim. Pale warm grey sand floor along the bottom fifth. Light, warm, high contrast between orange glow and teal water; avoid black. Empty stage: …"
- **Icons (both sheets):** "The attached reference image is ONLY a guide for the icon style: match its chunky pixels, colours and thick dark brown outlines; do not copy its icons." + T-12 SHEET block + "Four chunky pixel-art game icons, bold simple shapes with thick dark outlines, readable at 32 pixels, arranged in a 2 by 2 grid with wide gaps, each icon roughly square:"
  - icons_1: TL tilted cream-and-brass fish-food tin with orange/yellow flakes falling; TR brass magnifying glass over a small glass fish tank with an orange fish; BL round brass medallion framing a glass slot with a mint-green plus; BR paint brush with seafoam tip over a cream palette (coral, seafoam, gold dabs).
  - icons_2: TL festival bunting (red/yellow/seafoam flags) + confetti; TR orange fish leaping out of a blue-white splash; BL pale fog cloud over two blue wave crests; BR fingers pinching fish food with flakes falling.

## Processing (`docs/art/tools/t39_*`)
- `t39_fetch.sh <name> <url>` → `assets/_raw/t39/<name>.png` + preview.
- `t39_build.cjs`: kelp_a → `assets/_cut/train/interior_kelp.png` (2752×1548); **vent_b painted the tank side walls + ceiling edge → cropped x 361–2391, y 220–1362 and upscaled** → `interior_vent.png` (2752×1548). Icons = quadrant crops of the transparent sheets, alpha ≤ 40 zeroed, trimmed → `assets/_cut/icons/<name>.png`.
- `npx tsx scripts/optimize-assets.ts 'train/interior_kelp.png' 'train/interior_vent.png'` → `assets/train/interior_{kelp,vent}.{png,webp}` **1280×720** (old files were 1280×714; both 16:9-ish, render scales to the tank).
- `npx tsx scripts/pixelize.ts 'icons/<name>.png' …` (icons group, 32 px long side): feed 28×32, tankview 32×28, special_slot 27×32, special_cosmetic 32×28, sight_festival 32×24, sight_stowaway 31×32, sight_seafog 32×26.
- Feed pick: the tin (icons_1 TL) reads better at 32 px than the pinching hand (skin blob); hand kept as `assets/_raw/t39/feed_pinch_alt.png`.
- `t39_contact.cjs` → `docs/art/candidates/T-39_contact.jpg`: old vs new interiors with real fish sprites composited, icons at 4× and 1× next to shell / shells_per_sec.

## Notes
- Kelp: olive leafy seadragon and golden seahorse are partly camouflaged against the kelp (thematic); orange/dark/pale fish read clearly. Vent: grey yeti crab, scaly-foot snail and ghost ray read clearly on the teal middle band.
- sight_festival is the busiest icon at 32 px (bunting + confetti) but still reads as bunting.
