# CLAUDE.md

## What this is
Violin Tools — a dark web app of focused practice tools for violinists. The current tool is **Scales**, a whole-neck fingerboard note map.

## Repo identity
Local folder `violin-scales/`; GitHub slug `julianken/violin-tools` — they differ, so pass the slug to `gh`. Default branch `main`.

## Design source of truth
`DESIGN.md` (repo root) is the canonical design language and **wins on any conflict** — read it before any UI, token, or motion work. The architecture, data model, routing, and music-engine algorithm live in the design spec under `docs/` — consult it when scaffolding code; don't restate the stack here.

## Self-containment / continuous-pitch rule
Don't reference any other instrument, music app, website, or external inspiration anywhere in the repo — code, comments, copy, or PRs. The violin fingerboard is unmarked, with no fixed pitch divisions: name locations `fingerboard`, `neck`, `position`, `semitone column`. See `DESIGN.md §0/§1`. This is a correctness rule, not a style note — violations are review findings.

## Conventions
- **Commits:** Conventional Commits; bodies explain *why*. No git trailer is configured, so append `Co-Authored-By: Claude <model> <noreply@anthropic.com>` by hand, matching the active session model.
- **PRs:** follow `.github/PULL_REQUEST_TEMPLATE.md` (diagram-first). Screenshots via the `pr-screenshots-via-user-attachments` skill — never commit image files.
- **Review:** dispatch the `reviewing-as-julianken-bot` subagent (never `gh pr review` from the main session); for design-surface changes, also run a design-system review pass before approving. Cycle to approval, then squash-merge.

## Working in the tree
Run `git status` / `ls` for current state — don't trust a snapshot here. Build/test commands, the package manager, and architecture notes get added to this file once they actually exist.
