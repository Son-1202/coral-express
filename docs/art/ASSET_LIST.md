# Asset list & generation plan (PM-owned input for ART tickets)

Models: `nano_banana_pro` (resolution 2k) for scenes/characters/key art/fish; `gpt_image_2_6` for icons and small props. Every prompt starts with the STYLE BLOCK (CLAUDE.md). After the style bible exists, every generation passes it in `medias` as `image_references` (use its job id).
Transparency: ask for a plain flat light-grey background, then `remove_background`, then `scripts/pixelize.ts` (DEV-owned) for sprites/icons.
Sheets: small sprites are generated as grid sheets (one subject per cell, generous spacing, same scale, all facing right) and sliced into separate files by ART with sharp (`npx tsx` scratch script kept under `docs/art/tools/`).

| Group | Files | Count | How | Est. cr |
|---|---|---|---|---|
| Style bible | assets/style_bible.png | 3 cand. | single 16:9 | 6 |
| Scenery L1–L3 | assets/scenery/l{1-3}_{far,mid,near}.png | 9 ×2 cand. | single 21:9; mid/near bg-removed | 36 |
| Far time-of-day | assets/scenery/l{1-3}_far_{morning,dusk,night}.png | 9 | single 21:9, reference = base far | 18 |
| Stations | assets/station/l{1-3}.png | 3 | single 16:9, bg-removed | 6 |
| Locomotive / car shell | assets/train/locomotive.png, car_shell.png | 2 ×2 cand. | single 16:9, bg-removed | 8 |
| Interiors | assets/train/interior_{reef,mangrove,kelp,polar,vent}.png | 5 | single 16:9 no plants | 10 |
| Backdrop variants | assets/train/backdrop_<habitat>_{1,2}.png | 10 | single 16:9 | 20 |
| Wheel + rod | assets/train/wheel.png, rod.png | 1 sheet | gpt | 0.75 |
| Fish | assets/fish/<id>.png | 18 → 3 sheets ×2 cand. | 3×2 grid per Line | 12 |
| Shiny fish | assets/fish/<id>_shiny.png | 3 sheets | reference = normal sheet | 6 |
| Plants | assets/plants/<habitat>_<n>.png | 5 sheets (4 each) | 1:2 cells | 10 |
| Decor | assets/decor/<id>.png | 13 → 3 sheets | | 6 |
| Foliage | assets/scenery/l{1-3}_foliage_{1-3}.png | 3 sheets | | 6 |
| Roadside props | assets/scenery/l{1-3}_props_{1-4}.png | 3 sheets | | 6 |
| Wildlife | assets/wildlife/<id>.png | 9 → 3 sheets | | 6 |
| Sights | assets/sights/{dolphin,gull,whale}.png | 1 sheet | gpt | 0.75 |
| Passengers | assets/passengers/p1..p12.png | 2 sheets | gpt | 1.5 |
| Icons | shell/ticket/stamp, upgrade_<id>×8, tab_<name>×4 | 2 sheets | gpt | 1.5 |
| Photo frames | assets/ui/photo_frames_{1-3}.png | 3 | gpt | 2.25 |
| Wren portrait | assets/ui/wren_portrait.png | 1 | | 2 |
| Title / ending key art | assets/ui/title_keyart.png, ending_keyart.png | 2 ×2 cand. | | 8 |
| Postcards | assets/ui/postcard_<station>.png | 18 | single 3:2 | 36 |
| Line covers | assets/ui/line_cover_{1-3}.png | 3 | | 6 |
| **Images subtotal** | | | | **≈ 215 (+25% retries ≈ 270)** |
| Video | title loop, ending dive, 3 line openings | 5 (×2 takes) | kling3_0_turbo 5 s 720p ≈ 7.5 | ≈ 75 |
| Music/ambience | main theme, 3 line variants, 3 ambience, depot, whale song, ending | 10 (×2 takes on music) | elevenlabs_music_v2_5 ≈ 13 per 90 s | ≈ 230 |
