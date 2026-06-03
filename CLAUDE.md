# CLAUDE.md

## What this is
Violin Tools — a dark web app of focused practice tools for violinists. Its first tool is **Scales**, a whole-neck fingerboard note map.

## Repo identity
Local folder `violin-scales/`; GitHub slug `julianken/violin-tools` — they differ, so pass the slug to `gh`. Default branch `main`.

## Design source of truth
`DESIGN.md` (repo root) is the single source of truth and **wins on any conflict** — read it before any UI, token, or motion work. It also holds the note-map's pitch-classification model (§12.5). Don't restate any of it elsewhere.

## Conventions
- **Commits:** Conventional Commits; bodies explain *why*. No git trailer is configured, so append `Co-Authored-By: Claude <model> <noreply@anthropic.com>` by hand, matching the active session model.
- **PRs:** follow `.github/PULL_REQUEST_TEMPLATE.md` (diagram-first). Screenshots via the `pr-screenshots-via-user-attachments` skill — never commit image files.
- **Review:** dispatch the `reviewing-as-julianken-bot` subagent (never `gh pr review` from the main session); for design-surface changes, also run a design-system review pass before approving. Cycle to approval, then squash-merge.

## Disclosure & sensitivity
Personal open-source project — no compliance, regulatory, or auditability requirement. The git / PR / commit trail is a courtesy to people reading the project, not a mandate: commit messages and PR descriptions may be terse, and design deliberation lives in working chat/notes, not git. Terse is fine; **false is not** — never misrepresent what a change did, rubber-stamp a review, or rewrite history to hide that something changed.

When unsure whether something is sensitive, treat it as sensitive and keep it out of the repo. Sensitivity levels:

| Level | Covers | Handling |
| --- | --- | --- |
| **Secret** | Credentials, tokens, API keys, passwords | Never commit; if exposed, rotate the value and remove it. |
| **Private** | Personal data / PII, private third-party information | Keep out of the repo entirely. |
| **Security-sensitive** | Exploit / vulnerability detail, infra internals that materially aid an attacker | Keep out, or handle privately. |
| **Working / internal** | Reasoning, deliberation, scratch notes | Fine to keep out of git; no obligation to publish. |
| **Public** | The code, design, and docs themselves | This *is* the project — commit it openly. |

## Working in the tree
Run `git status` / `ls` for current state — don't trust a snapshot here. Build/test commands, the package manager, and architecture notes get added to this file once they actually exist.
