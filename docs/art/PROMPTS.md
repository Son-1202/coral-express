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
