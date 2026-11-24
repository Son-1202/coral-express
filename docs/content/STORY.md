# Coral Express — Story content (T-03)

All narrative text lives in `src/story/*.json` (English). Tone: cozy, gentle, wistful picture-book seaside road trip. Wren signs every postcard "Love, Wren".

## Line budget (SPEC B6: postcards + notes + ending + tips ≤ 35)
| Group | File | Lines |
|---|---|---|
| Station postcards (18, ≤ 40 words each; longest 36) | `postcards.json` → `postcards` | 18 |
| Notes: firstDepotReset, lineOpened2, lineOpened3 | `postcards.json` → `notes` | 3 |
| Ending: 5 unique text beats + `endlessToast` (beat 2 re-shows postcard `l3s6`, not counted twice) | `ending.json` | 6 |
| Tutorial tips | `tips.json` | 5 |
| **Total** | | **32 / 35** |

Outside the budget (separate allowances in B6): 18 station names + greetings (`stations.json`), 18 stamp flavor lines ≤ 20 words (`stamps.json`, longest 15), 36 Passenger Requests (`requests.json`), credits.

## Arc
- L1–L2 postcards hint the line "doesn't really end at the last station" (l1s6), promise of "warmer seas" (l2s1), track plans in the recipe tin (l2s6).
- l3s5: "I meant to take them home one day." The underwater twist is only stated in the l3s6 postcard, which is shown during the ending (beat `postcard`, `postcardRef: "l3s6"`). DEV: do not toast the l3s6 postcard on arrival before the ending starts.

## File notes for DEV
- `stations.json`: `stallkeeper.tint` = apron tint hex; `passengerSprite` 1–12.
- `ending.json` beats in order: `beachSlowdown`, `postcard` (text null → use postcards l3s6), `dive`, `glassOpens`, `panorama`, `theEnd`. Credits are `{role, names[]}`.
- `requests.json`: 12 per Line (ids `r_l{line}_{nn}`). `stationId` omitted = any station of that line. Decor condition items are `{decorId, count}` or `{plantAny: true, count}` (any plant decor, listed or unlisted sprite). Reward seconds follow B4.13: species 180, appeal 240, community 300 + cosmetic.
- Appeal targets: L1 10/25/40, L2 40/80/120, L3 100/180/300.
- `wren_photo` is rewarded by `r_l1_11` (Wren's Old Neighbour, l1s3: Sea-Glass Pebbles + any plant).
- **Cosmetic ids introduced** (need DEV/ART definitions in the cosmetics list, B4.3): `paint_coral_pink` (paint), `sand_shell_white` (sand), `backdrop_kelp_cathedral`, `backdrop_polar_aurora`, `backdrop_vent_ember_glow` (habitat backdrop variants for Kelp, Polar, Vent).
- `tips.json`: `trigger` ids match ticket: buyFirstFish, makeFirstPair, feedCarriage, tankViewPlant, requestsBoard. Each tip is one dismiss-tap max.
