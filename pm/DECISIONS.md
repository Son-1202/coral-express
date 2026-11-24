# Decisions log

- **D-001 (Phase 0)** Advisor skill unavailable (no Fable advisor in skill list) → skip all A2c advisor steps.
- **D-002** Repo already existed (empty) at Son-1202/coral-express; `gh repo create` skipped. Only `gh api` REST works in this cloud environment.
- **D-003** Git author email = GitHub noreply address for Son-1202 (no GIT_AUTHOR_EMAIL in config; keeps personal email private).
- **D-004** Commits go to `main` per producer config; the harness's session branch `claude/zen-mendel-ogysoe` is pushed with the same HEAD as a mirror.
- **D-005** No AI co-author trailers in commits (ATTRIBUTION setting).
- **D-006** Full spec copied into `docs/content/SPEC.md` so subagents read numbers from a file, not from PM memory.
- **D-007** Subagents: Opus via Agent tool `model: opus`, effort per ticket.
