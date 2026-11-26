# T-37 prompt log: festival decorations

**Date:** 2026-11-26 · **Full prompts:** `docs/art/tools/t37_prompts.cjs` (STYLE BLOCK verbatim + palette line + flat grey #c8c8c8 bg).
No style reference (D-021: avoids scene leakage on isolated sprites); `gpt_image_2_6` 2k medium (D-024). All four accepted first try.

## Credits
| Item | Count | Unit | Cost |
|---|---|---|---|
| gpt_image_2_6 2k medium | 4 | 1.75 | 7.00 |
| **Total T-37** | | | **7.00 / 10** |

Balance 416.04 → 409.04 (verified with `balance`).

## Jobs
| Asset | Job id | Result |
|---|---|---|
| bunting (21:9) | `d7567498-fbe9-4731-a9d7-a1c40b9f14db` | KEPT: 12 pennants, straight twine, 6-colour cycle |
| lanterns (21:9) | `859b7667-f05a-4940-ad40-ddb014a2c860` | KEPT: 9 lanterns, straight cord, 4-colour cycle |
| confetti (asked 2:1, served 16:9) | `084961db-25e8-4a1b-a2f6-476e2804e994` | KEPT: clean 4×2 grid |
| flag (1:1) | `10fe1d75-d0f4-4fb6-add0-bd6f2e47d9a0` | KEPT |

## Processing (`npx tsx docs/art/tools/t37_build.ts`)
- Raw → `assets/_raw/t37/`; grey keyed locally with `t10_keylib` (D-022) → `assets/_cut/festival/`.
- **Strips**: rope row found, gaps between pennants/lanterns detected; cut from gap 0 to gap N (N = one colour cycle: 6 pennants / 4 lanterns), so both edges are rope-only; last 12 src columns cross-faded into column 0; downscaled ×0.25 with `areaResize` + alpha threshold + 48-colour quantize (no trim/outline so width = exact period; art already has dark outlines).
- **Confetti**: 8 cells trimmed, shared scale, placed centred in 32×32 cells → `confetti.png` (128×64, 4×2, index = row*4+col+1); `confetti_<n>.png` = trimmed cells.
- **Flag**: project pixelizer `pixelizeFile`, 96 px tall.
- Contact: `node docs/art/tools/t37_contact.cjs` → `docs/art/candidates/T-37_contact.jpg` (strips tiled ×3 at 3×, red ticks = seams; mock over the producer screenshot).

## Outputs (for DEV T-38)
| File | Size | Notes |
|---|---|---|
| `festival/bunting.png` | 337×45 | tile horizontally (period 337 px, 6 pennants); twine occupies rows 1–~6 at the top edge; pennants hang below |
| `festival/lanterns.png` | 296×64 | period 296 px (4 lanterns: yellow, green, cream, red); cord ~1 px from the top |
| `festival/confetti.png` | 128×64 | 4×2 grid of 32 px cells: rect, curl, square, spiral / dot, star, wave, triangle |
| `festival/confetti_1..8.png` | 12–26 px | trimmed slices, same order |
| `festival/flag.png` | 75×96 | base spans x 5–21 at the bottom (pole centre ≈ x 13); pennant flies right |

Scale: pennant ≈ 40 px wide, lantern ≈ 44 px; looked right at 2× in the mock (see contact). Glow is painted in the lanterns; add an additive glow sprite/emissive in code for night if wanted.
