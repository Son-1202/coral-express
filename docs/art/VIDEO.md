# VIDEO — T-17 cinematic clips

Model: `kling3_0_turbo`, 720p, 16:9, image-to-video (`start_image` = approved T-16 key art job id).
Cost rate: 1.5 cr/s (5 s = 7.5, 8 s = 12, 10 s = 15). Budget ≤ 100 cr.

## Jobs (batch 1, submitted 2026-11-24)
| # | clip | start image | job id | dur | cr |
|---|---|---|---|---|---|
| 0 | title_loop take A | title_C `19fb4e33-01cf-493b-b12a-09c4f46a7ece` | `c988c193-b396-4445-b6c0-4ac794cbab29` | 8 | 12 |
| 1 | title_loop take B | title_C | `39fad4dd-0e39-4258-913f-867f3bb85d42` | 8 | 12 |
| 2 | ending_dive take A | ending_C `60fb7b79-9da4-469e-9b76-8b3347ebd27d` | `be8163fb-7127-48af-94c2-25ae54149f5b` | 10 | 15 |
| 3 | ending_dive take B | ending_C | `4fc33991-bea3-43dc-aa40-8fffb013c76d` | 10 | 15 |
| 4 | line_1 | line_cover_1 `2e4f6952-91ee-43ad-8b8a-d49ff7d6639b` | `4380093b-fbd5-4f5e-b0a8-75060cdc4044` | 5 | 7.5 |
| 5 | line_2 | line_cover_2 `66d350a2-1d72-40c7-8c8a-acc16ce01048` | `e2641357-7c77-4da8-9b36-0a8d20f48a1e` | 5 | 7.5 |
| 6 | line_3 | line_cover_3 `3c92f2fd-4ab2-4b13-84bb-ea2a85eb7009` | `f6f38071-f858-4b3f-97b4-4c88007ff7ea` | 5 | 7.5 |

Batch 1 total: 76.5 cr.

## Prompts
- **0 title A:** Gentle seamless ambient loop of this HD-2D pixel-art seaside diorama. The train stays parked at the platform and does not move. Waves lap softly at the shore and sunlight glitters on the sea, a thin wisp of steam drifts up from the locomotive chimney, the waiting passengers shift and wave slightly, small fish swim slowly inside the glass aquarium carriages, seagulls glide far away, the platform lamp flickers warmly. Static locked-off camera, no zoom, no pan, no cuts, keep the pixel-art painterly style.
- **1 title B:** Calm living-painting loop: the parked seafoam-green train sits still at the seaside platform; soft steam curls from its chimney, colourful fish drift and turn inside the glass carriages, gentle waves roll in the sunset sea, distant gulls circle, passengers sway and wave. Static camera, subtle motion only, no cuts, no camera movement, preserve the crisp pixel-art look.
- **2 ending A:** The glass-carriage steam train glides slowly to the right along the seabed rails, sunbeams shimmer and ripple down through the water, schools of wild silver and yellow fish swirl around and through the open glass carriages, sea turtles and manta rays swim past, bubbles rise. Slow gentle camera drift following the train, no cuts, keep the HD-2D pixel-art painterly style.
- **3 ending B:** Dreamy underwater scene: the vintage train with open glass aquarium carriages rolls slowly forward along the sea floor, light rays dance through the water, a huge school of fish swirls in a spiral around the train and through the carriages, manta rays glide overhead, turtles paddle by, coral sways. Slow cinematic camera drift, one continuous shot, no cuts, pixel-art storybook style.
- **4 line_1:** The small seafoam-green train travels slowly to the right across the stone viaduct, puffs of white steam trail behind it, sailboats drift on the glittering bay, seagulls fly over the lemon trees, leaves rustle in the breeze. Gentle slow camera push-in, no cuts, keep the HD-2D pixel-art painterly diorama style.
- **5 line_2:** The small seafoam-green train travels slowly to the left along the lakeside track, steam puffs from its chimney, morning mist drifts across the still fjord lake and between the mountains, birds fly across the sky, the reflections ripple gently. Gentle slow camera push-in, no cuts, keep the HD-2D pixel-art painterly diorama style.
- **6 line_3:** The small seafoam-green train travels slowly to the left along the wooden pier over the turquoise lagoon, steam puffs from its chimney, smoke billows gently from the volcano, palm trees sway, waves lap the black-sand beach, seabirds glide. Gentle slow camera push-in, no cuts, keep the HD-2D pixel-art painterly diorama style.

Balance 546.29 → 469.79 (**76.5 cr spent**, within the 100 cr budget). No retries, no Seedance needed.

## Selection (frames at 0 / ⅓ / ⅔ / end extracted with ffmpeg and reviewed)
| clip | kept | why |
|---|---|---|
| title_loop | **take A** `c988c193` | Both takes are calm and static-camera (train stays parked, steam, waves, gulls, fish). A's steam fades out by the end, so its last frame matches the steam-free first frame better (better loop seam); B ends with a visible steam plume. |
| ending_dive | **take A** `be8163fb` | Coherent the whole way: fish schools, mantas, turtles, sunbeams, slow drift. Take B has the requested swirl through the carriages but in the second half the school smears into a blurry ring and a shipwreck appears. Note: both show a small steam wisp underwater (reads as bubbles at game size). |
| line_1 | `4380093b` | Train crosses the viaduct to the right, gulls, sailboats, slow push/pan. Good. |
| line_2 | `e2641357` | Train runs left along the lake, mist drifts, birds, gentle push-in. Good. |
| line_3 | `f6f38071` | Train on the pier, volcano smoke, gulls, palms. Train moves only slightly (fine for a 5 s cover). |

## Post-processing
- Source: 1284×716, 24 fps. Output scaled to **1280×714** (lanczos), yuv420p, no audio.
- MP4: `libx264 -crf 28 -preset slow -movflags +faststart -an`. WebM: `libvpx-vp9 -crf 38 -b:v 0 -an`. Poster: frame 0 JPG (`-q:v 3`).
- title_loop: seamless loop built by dropping the first 0.5 s and xfading (fade, 0.5 s) the clip's tail into its first 0.5 s → 7.54 s; the last output frame blends into the first.

| file | mp4 | webm | duration |
|---|---|---|---|
| title_loop | 0.44 MB | 0.42 MB | 7.54 s |
| ending_dive | 1.90 MB | 2.38 MB | 10.04 s |
| line_1 | 0.56 MB | 0.58 MB | 5.04 s |
| line_2 | 0.34 MB | 0.28 MB | 5.04 s |
| line_3 | 0.44 MB | 0.43 MB | 5.04 s |

All ≤ 4 MB. Raw downloads (all 7 takes, ~69 MB) kept in `assets/_raw/t17/` — PM may want to exclude these from git (large).

## Notes for DEV
- Use `<video muted playsinline autoplay loop poster=…jpg>` with `<source>` webm first, then mp4. title_loop has `loop`; ending_dive and line_* play once (or loop if desired; they don't loop seamlessly).
- Posters are frame 0 of each final video, so the poster→video swap is invisible. Line/ending clips start on their key art exactly; title_loop starts 0.5 s in (near-identical to title_keyart).
