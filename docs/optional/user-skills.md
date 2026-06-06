# Optional module — user-level skills overlay

**Optional.** Some of this repo's process knowledge exists in *two* layers: a **repo-local** canonical copy under [`.claude/skills/`](../../.claude/skills/) that any cold-start agent can read, and a **user-level** overlay (Julian's `~/.claude/skills/`) shared across his repos. A template consumer who never installs the user-level skills loses nothing essential — the repo-local copies are self-contained for opening and judging a PR here.

This doc explains *when* the user-level layer overlays the repo-local one. The authoritative ledger of which copy wins on conflict and the same-PR no-drift rule is [`AGENTS.md`](../../AGENTS.md) → "Skill ownership" — this doc is the adopt-or-skip framing, not a second copy of that ledger.

## The two layers

| Layer | Lives in | Owns |
| --- | --- | --- |
| **Repo-local (canonical method + instance facts)** | [`.claude/skills/`](../../.claude/skills/) | The generic five-section PR-body method ([`creating-prs`](../../.claude/skills/creating-prs/SKILL.md)), the bot-agnostic anti-slop rubric ([`reviewing`](../../.claude/skills/reviewing/SKILL.md)), and the violin-tools instance facts that plug into them ([`pr-workflow`](../../.claude/skills/pr-workflow/SKILL.md), plus `issue-authoring` / `issue-plan-review`). A worktree-isolated subagent reads these directly. |
| **User-level (optional overlay)** | `~/.claude/skills/` (per-developer, shared across repos) | The bot **identity + credential mechanics** (`reviewing-as-julianken-bot`), the merge **command flow** (`mergify-merge-workflow`), the screenshot paste flow (`pr-screenshots-via-user-attachments`), and the **portable** namesake of the method (user-level `creating-prs`). |

The split is deliberate: a cold-start agent that can read only `.claude/skills/` is **not dependent** on a developer's `~/.claude/skills/` to describe the PR body or apply the review rules. The user-level layer adds only what is genuinely personal/cross-repo (credentials, the developer's shared method copy) — it never owns something the repo can't function without.

## When the overlay applies

- **It loads on top of the repo-local copy, not instead of it.** `reviewing-as-julianken-bot` *extends* the repo-local `reviewing` rubric with the bot identity and credential loading — it doesn't fork the rubric. You read the repo-local rubric to *judge* a diff; you load the overlay only to *post* the gating verdict as the bot.
- **On conflict:** the repo-local skill wins for anything violin-tools-specific (the ruleset, what's in our template) and for the **generic method** itself (`creating-prs` / `reviewing`). The user-level skill wins only for the **portable** form of the method and for the bot identity/credential mechanics the repo-local rubric deliberately doesn't carry.
- **No-drift:** the method exists as two mirrored pairs — repo-local `creating-prs` ↔ user-level `creating-prs`, and repo-local `reviewing` ↔ user-level `reviewing-as-julianken-bot`. A change to either copy of a pair must update the other in the **same PR**, and the PR Summary must say so. (This rule lives in `AGENTS.md` → "Skill ownership"; it binds whether or not you've installed the user-level layer.)

## Adopt

Install the user-level skills into `~/.claude/skills/` if you want the bot-posting path, the Mergify command flow, or the cross-repo portable method. They overlay automatically once present. Honor the same-PR no-drift rule when you change a mirrored method copy.

## Skip

If you only ever use the repo-local `.claude/skills/`, you can open and review a PR here without the user-level layer — you just can't *post as the review bot* (see [`review-bot.md`](./review-bot.md)) or use Julian's personal screenshot/merge command flows. Nothing in the core process breaks; the overlay is additive.
