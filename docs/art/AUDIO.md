# Audio log (ART, T-11) — 2026-11-24

## Budget
- Balance before: **970 cr**. Balance after: **727.54 cr**. The other ~48 cr between those two readings was Nano Banana Pro image spend from a concurrent ticket (seen in `transactions`), not audio.
- **T-11 audio spend: 194.46 cr** (budget 300), confirmed line by line in `transactions`:
  - ElevenLabs Music v2.5: 8 × 90 s @ 13.08 + 2 × 60 s @ 8.72 + 2 × 120 s @ 17.44 = **156.96**
  - Mirelo SFX ("Sound Effects"): 3 × 45 s @ 11.25 + 1 × 15 s @ 3.75 = **37.50**
- Unit prices quoted: elevenlabs_music_v2_5 ≈ 0.1453 cr/s per take; mirelo_text_to_audio = 0.25 cr/s.
- Model limits (`models_explore get`): elevenlabs_music_v2_5 duration 3–600 s; mirelo_text_to_audio has no stated max, and 45 s was delivered in full, so nothing is short.

## Final files (`assets/audio/`, all 128 kbps CBR, 44.1 kHz stereo)
| file | kept take | dur | size | loudness target |
|---|---|---|---|---|
| music_main.mp3 | B | 90.07 s | 1.44 MB | −16 LUFS |
| music_l1.mp3 | A | 90.07 s | 1.44 MB | −16 LUFS |
| music_l2.mp3 | A | 90.07 s | 1.44 MB | −16 LUFS |
| music_l3.mp3 | B | 90.07 s | 1.44 MB | −16 LUFS |
| music_depot.mp3 | A | 60.06 s | 0.96 MB | −18 LUFS |
| music_ending.mp3 | A | 117.94 s | 1.89 MB | −16 LUFS |
| sfx_whale_song.mp3 | single | 15.05 s | 0.24 MB | −20 LUFS |
| amb_l1.mp3 | single | 45.04 s | 0.72 MB | −24 LUFS |
| amb_l2.mp3 | single | 45.04 s | 0.72 MB | −24 LUFS |
| amb_l3.mp3 | single | 45.04 s | 0.72 MB | −24 LUFS |

Processing: two-pass ffmpeg `loudnorm` with `linear=true` (a single gain per file, so the loop seams are not changed), true peak ≤ −1.5 dBTP (measured peaks −2.5 to −8 dB). None of the loops started or ended in silence, so I trimmed nothing from them and added no fades. The ending's raw take had 2.4 s of trailing silence: I trimmed it at 117.9 s with a 0.5 s fade-out. The untouched provider files are in `assets/_raw/audio/` (`<track>_A/_B.mp3` for music, `<track>.mp3` for SFX and ambience).

**Mix notes for DEV:** the music is about 8 LU louder than the ambience on purpose. In Howler, start with ambience at about 0.6–0.8 under music at about 0.5. `amb_l1` gets louder over its length (waves build: first 3 s −33.8 dB, last 3 s −20.9 dB raw), so loop it with a crossfade of at least 3 s. The other ambiences are steady to within about 2 dB from end to end.

## How I chose takes (I can't listen, so this rests on measurements)
Measurements used: total length, `volumedetect` mean/max, `silencedetect` (−45 dB, 0.4 s), RMS of the first 3 s against the last 3 s (the loop seam step), and the spread (standard deviation) of RMS over 10 s windows (how steady the energy is; lower is better for a loop). "Δseam" below means the dB gap between the first-3 s RMS and the last-3 s RMS.

| track | A: Δseam / sd / tail silence | B: Δseam / sd / tail silence | kept | why |
|---|---|---|---|---|
| main | 0.6 / 0.39 / none | 0.6 / 0.24 / none | **B** | Same seam gap, steadier energy (A rises 1 dB over the first 40 s, which reads like an intro) |
| l1 | 0.5 / 0.24 / none | 2.3 / 1.48 / none | **A** | B jumps 3 dB at about 40 s (a section change, so a bad loop) |
| l2 | 0.1 / 0.40 / none | 1.0 / 0.50 / none | **A** | Tightest seam |
| l3 | 0.0 / 0.37 / none | 0.1 / 0.23 / none | **B** | Steadiest; A has a soft first 20 s |
| depot | 3.2 / 0.50 / none | 18.3 / 0.68 / 0.7 s silence | **A** | B fades out to silence at the end, so it can't loop |
| ending | starts −25.6, peaks about −15.4 at 70–90 s, falls off | starts −17.1, fairly flat | **A** | Follows the "begins softly, swells" brief; B starts at full level |

I can't check from the files that tempo is ~96 bpm or that the instruments match the prompts. Someone should listen to them in-game.

## Prompts (model, job id)
All music: `elevenlabs_music_v2_5`, `force_instrumental: true`, batch submitted 05:47 UTC.

| take | job id | duration | prompt |
|---|---|---|---|
| main A | 17af892f-b0c7-456c-947a-86d6e9c73a46 | 90 | Instrumental cozy picture-book seaside travel theme for a gentle train journey game. Warm accordion melody with plucked ukulele chords over a soft train-rhythm shuffle on brushed snare and light shaker, upright bass, about 96 bpm, major key, whimsical and wistful. Seamless loop, consistent tempo and energy throughout, no intro, no fade-out, no vocals. |
| main B ✔ | 02f52603-97ca-405e-a2c5-193e35914f03 | 90 | Instrumental lighthearted folk travel loop, accordion lead and strummed ukulele, chugging train-wheel shuffle groove with brushes, 96 bpm steady, sunny seaside picture-book mood, gentle and cozy, light glockenspiel accents. Seamless loop, constant tempo, starts immediately on the groove, no fade-out, no vocals. |
| l1 A ✔ | 00347a76-f503-4d69-abc6-e5de086b50f0 | 90 | Instrumental Sunny Coast travel theme: bright tremolo mandolin lead over ukulele and soft accordion pads, gentle train-rhythm shuffle on brushes, 96 bpm, sunny Mediterranean seaside, lemon trees, cozy picture-book mood. Seamless loop, consistent tempo, no intro, no fade-out, no vocals. |
| l1 B | b39fcb59-8f54-44a1-9738-e60a332a032e | 90 | Instrumental cheerful acoustic loop, sparkling mandolin melody, fingerpicked guitar and ukulele, light shaker and brushed snare train shuffle, 96 bpm, warm sunny coastal village morning, cozy and gentle. Seamless loop, constant tempo, no intro, no fade-out, no vocals. |
| l2 A ✔ | aeb0f291-0301-4375-838c-6b11d043c209 | 90 | Instrumental Fog Fjords travel theme: lyrical Nordic folk fiddle melody over a soft wordless choir pad (ooh, aah, no words), low drone, gentle train-rhythm shuffle on soft brushes, 92 bpm, misty cool northern fjord, wistful and cozy picture-book mood. Seamless loop, consistent tempo, no intro, no fade-out, no lyrics. |
| l2 B | 24510805-2bbc-44bc-aa93-9c0cb10d29f4 | 90 | Instrumental misty Scandinavian folk loop, slow singing fiddle lead, airy ethereal choir pad humming without words, soft harp arpeggios, muted frame-drum train pulse, 92 bpm, foggy fjord, gentle and calm. Seamless loop, constant tempo, no intro, no fade-out, no sung lyrics. |
| l3 A | 9b1382d6-37f6-4581-9127-e6590345e687 | 90 | Instrumental Volcano Isles travel theme: warm steel drum melody with rolling marimba, ukulele and soft hand percussion in a gentle train-rhythm shuffle, 96 bpm, tropical island, cozy picture-book mood, relaxed and sunny. Seamless loop, consistent tempo, no intro, no fade-out, no vocals. |
| l3 B ✔ | a4b8be33-08f9-427a-98ca-72af91fbf4ce | 90 | Instrumental laid-back tropical loop, mellow steel pan lead, marimba ostinato, bongos and shaker shuffle like train wheels, warm bass, 96 bpm, volcanic island beach at golden hour, gentle and cozy. Seamless loop, constant tempo, no intro, no fade-out, no vocals. |
| depot A ✔ | a88c2885-c9b3-4fb3-8524-56df13a03e65 | 60 | Instrumental calm restful theme for a cozy train depot: delicate music box melody with soft felt piano, warm gentle pads, slow 72 bpm, lullaby-like, picture-book nostalgia, peaceful. Seamless loop, consistent tempo, no intro, no fade-out, no vocals. |
| depot B | 2698acc2-6892-4b39-be59-c57a747557b0 | 60 | Instrumental soft lullaby loop, music box twinkling melody over intimate felt piano chords, faint warm strings, 70 bpm, quiet restful evening in an old railway workshop, cozy and tender. Seamless loop, constant tempo, no intro, no fade-out, no vocals. |
| ending A ✔ | f00b38eb-9ceb-4ffd-8ea1-b09f94da98b4 | 120 | Instrumental tender ending theme for a cozy picture-book game: begins softly with harp and gentle strings, swells into a warm cinematic orchestral climax of underwater wonder as a train dives into the sea, shimmering celesta, then an accordion reprise of a cozy seaside travel melody, emotional, hopeful, wistful. No vocals. |
| ending B | aa52dbc2-7185-4bbf-8ad9-146578531d30 | 120 | Instrumental emotional finale: flowing harp arpeggios and lush string orchestra slowly swelling, sense of vast underwater wonder and freedom, sparkling glockenspiel bubbles, warm accordion returning with a nostalgic folk travel melody, tender and heartfelt, gentle resolution at the end. No vocals. |

SFX/ambience: `mirelo_text_to_audio`, one take each (the ticket asks for 2 takes only for music).

| file | job id | duration | prompt |
|---|---|---|---|
| sfx_whale_song | 67ed0bf9-7e09-45b6-b3b1-08c9a94ce773 | 15 | Humpback whale song underwater: deep, slow, melodic moans and rising calls, long echoing reverb through the ocean, soft distant water ambience, no music. |
| amb_l1 | 41d96515-0f65-445e-b731-65c92d41af1b | 45 | Calm seaside ambience: gentle small waves lapping on a sandy shore, soft continuous surf, occasional distant seagull calls, light breeze, peaceful sunny day, steady and loopable, no music, no voices. |
| amb_l2 | eecd0b02-2600-4438-b173-2b5bbb98a256 | 45 | Misty fjord ambience: cold steady wind blowing over a wide fjord, soft lapping water against rocks, a deep distant ship foghorn sounding occasionally far away, quiet and atmospheric, steady and loopable, no music, no voices. |
| amb_l3 | d993ec29-50a2-475d-8110-6e9750b4d8ae | 45 | Tropical island beach ambience: rolling surf on a beach, warm breeze through palm leaves, colorful tropical birds chirping and calling in the jungle nearby, steady and loopable, no music, no voices. |

## For PM
- Add to pm/CREDITS.md: T-11 | 10 audio tracks (16 gens) | elevenlabs_music_v2_5 + mirelo_text_to_audio | 194.46 cr.
