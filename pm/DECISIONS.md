# Decisions log

- **D-001 (Phase 0)** Advisor skill unavailable (no Fable advisor in skill list) → skip all A2c advisor steps.
- **D-002** Repo already existed (empty) at Son-1202/coral-express; `gh repo create` skipped. Only `gh api` REST works in this cloud environment.
- **D-003** Git author email = GitHub noreply address for Son-1202 (no GIT_AUTHOR_EMAIL in config; keeps personal email private).
- **D-004** Commits go to `main` per producer config; the harness's session branch `claude/zen-mendel-ogysoe` is pushed with the same HEAD as a mirror.
- **D-005** No AI co-author trailers in commits (ATTRIBUTION setting).
- **D-006** Full spec copied into `docs/content/SPEC.md` so subagents read numbers from a file, not from PM memory.
- **D-007** Subagents: Opus via Agent tool `model: opus`, effort per ticket.
- **D-008** Producer declined to store a Vercel token in this container; producer will import the repo into Vercel (Vite, `npm run build`, `dist`) so pushes to `main` auto-deploy. PM keeps `vercel.json` ready and reads the live URL from GitHub deployment statuses (`gh api repos/Son-1202/coral-express/deployments`). A5 `vercel link/git connect/--prod` steps are replaced by the dashboard import.
- **D-009** Budget plan (see docs/art/ASSET_LIST.md): full plan ≈ 600 cr (images ~270, music ~260 incl. 2 takes, video ~75). Balance 122 → top-up of ~500 requested. Until then, credits go to the style bible + Line 1 hero art.
- **D-010** Small sprites (fish, shinies, plants, decor, foliage, props, wildlife, passengers, icons, sights) are generated as **labelled grid sheets** (e.g. 3×2 per 2k image) and sliced in code. Final sprites are 48–80 px after pixelize, so a ~600 px cell is far above the needed resolution; sheets also keep a species family visually consistent. Not a quality trade-off; heroes (scenery, train, key art) stay single images with 2 candidates.
- **D-011** T-03 referenced 5 undefined cosmetic ids; PM remapped them to existing ids (sand_white, paint_red, backdrop_kelp_1/polar_1/vent_1) and renamed those backdrops "Kelp Cathedral", "Polar Aurora", "Ember Glow". The l3s6 postcard must NOT be toasted on arrival (spoils the twist): the ending shows it instead.
- **D-012** T-02 choices accepted: Stowaway tap window 8 s; Whale Breach doubles fish income and fares; unlisted plant prices 120 / 8e5 / 2e11 per Line; GDD adds `decorMult` term for decor income effects.
- **D-013** Style bible = candidate **B** (job 174186f2-e469-421b-a531-b0da32893b7b): best diorama depth, natural tilt-shift falloff, station + passengers, strongest HD-2D read. A/C rejected for hard blur bands. Its nameplate text is irrelevant (reference only). Saved as assets/style_bible.png (1920 px). All later generations pass this job id as `image_references`.
- **D-014** `nano_banana_pro` jobs report engine `nano_banana_2`; `nano_banana_pro` is a valid catalog id (backend routing), quality is excellent → keep requesting `nano_banana_pro`.
