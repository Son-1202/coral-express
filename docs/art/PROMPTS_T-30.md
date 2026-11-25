# T-30 prompt log — Shells/s HUD icon (ART)

Date 2026-11-25. Budget ≤ 6 cr. **Spent 1 cr** (balance 469.79 → 468.79).

## Job
| Sheet | Job id | Model / params / cost |
|---|---|---|
| shells_per_sec sheet (4 variants in one 2×2 image) | `905362ad-3f25-42fe-a374-4ebb6c4c990f` | gpt_image_2_6, 1:1, medium, 1k, 1 cr |

Reference: `medias[{value: 16162fa3-2130-4f18-a87b-5ec846149ac7 (T-12 icons_a sheet), role: image_references}]` so the scallop matches `shell.png`.

## Prompt
STYLE BLOCK + "The attached reference image is ONLY a guide for the icon style: match the pink-and-cream scallop seashell icon in the top-left exactly (same shell shape, colours, chunky pixels, thick dark brown outline)." + T-12 SHEET block + "Four variants of one chunky pixel-art game icon meaning 'shells earned per second / income rate', bold simple shapes with thick dark outlines, readable at 32 pixels, arranged in a 2 by 2 grid with wide gaps, each icon roughly square: top-left: the pink scallop shell with a small round brass stopwatch overlapping its lower right corner; top-right: the pink scallop shell with a small brass stopwatch beside it on the right; bottom-left: the pink scallop shell with a bold mint-green upward arrow rising at its upper right; bottom-right: the pink scallop shell with a short curving trail of golden sparkles rising up and to the right behind it."

## Pick + processing
- Raw: `assets/_raw/t30/sheet.png`; chosen variant = top-left (stopwatch overlapping shell: most compact, best silhouette at 32 px) → `assets/_raw/t30/v1_tl.png`.
- **Deviation:** output came back already transparent (as with T-12 icon sheets), so `key.cjs` was not needed; faint glow alpha ≤ 40 zeroed, trimmed → `assets/_cut/icons/shells_per_sec.png` (322×306).
- `npx tsx scripts/pixelize.ts 'icons/shells_per_sec.png'` → `assets/icons/shells_per_sec.png` 32×31 (icons group, 32 long side, same as shell.png 32×28).
- Preview: `docs/art/candidates/T-30_icons.png` (shell, ticket, stamp, new icon at 8× and 1×).
