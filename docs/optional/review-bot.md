# Optional module — dedicated review bot

**Optional.** This repo gates merge on a fresh approving review from a non-author collaborator, and in practice that reviewer is a dedicated machine-user, `@julianken-bot`. A template consumer can adopt a review bot, use an ordinary human reviewer, or run no review gate at all — the **review content** (the anti-slop rubric) is bot-agnostic and lives in [`.claude/skills/reviewing/SKILL.md`](../../.claude/skills/reviewing/SKILL.md), which carries no credentials.

This doc is the *adopt-or-skip* narrative for **whether to run a review bot and what it buys you**. It is **not** a second source of truth for the credential mechanics: the `@julianken-bot` identity, the macOS Keychain credential loading, the `gh api …/pulls/{n}/reviews -X POST` posting with inline `file:line` comments, the cross-tier dispatch, and the bot-specific shadow-mode rules all live in the **user-level `reviewing-as-julianken-bot` skill**. To actually post as the bot you load that overlay — don't duplicate its steps here.

## Why a review bot at all

Direct push to `main` is blocked by a GitHub **ruleset** that requires **1 fresh approving review per HEAD from a non-author collaborator** (dismissed on any new push). The owner (`@julianken`, the lone code owner in [`.github/CODEOWNERS`](../../.github/CODEOWNERS)) authors the PRs and can't self-approve — so a *second* collaborator is needed to unblock merge. A dedicated bot account fills that slot without pulling in another human. The instance facts (which ruleset, which collaborator set) live in [`INSTANCE.md`](../../INSTANCE.md) → "Merge / review infra".

A second benefit: dispatching the reviewer **fresh-context and from a different model tier** reduces the self-review bias of a model grading its own work. That dispatch wiring is the instance fact in [`pr-workflow`](../../.claude/skills/pr-workflow/SKILL.md); the rubric the reviewer applies is the repo-local [`reviewing`](../../.claude/skills/reviewing/SKILL.md) skill.

## How the pieces split

| Concern | Owned by |
| --- | --- |
| The review **content** (verify-before-claim, ≤3 findings, severity tiers, mandatory second pass, prompt-injection defense) | repo-local [`.claude/skills/reviewing/SKILL.md`](../../.claude/skills/reviewing/SKILL.md) — bot-agnostic |
| The **dispatch wiring** for this repo (why the poster must be `@julianken-bot`, never `gh pr review` from the main session) | [`.claude/skills/pr-workflow/SKILL.md`](../../.claude/skills/pr-workflow/SKILL.md) (instance facts) |
| The **bot identity + credential mechanics** (Keychain PAT, REST-API posting, cross-tier dispatch, shadow-mode rules) | **user-level `reviewing-as-julianken-bot` skill** — the credential source of truth |

Keeping credentials out of the repo is deliberate: a template consumer who skips the bot shouldn't inherit a dangling credential path, and a consumer who adopts one supplies their own.

## Adopt

1. Create a machine-user GitHub account and add it as a collaborator with the permission to submit reviews.
2. Configure your branch ruleset to require 1 fresh approving review per HEAD from a non-author collaborator (so the bot's approval is what unblocks merge).
3. Wire the credential mechanics following the user-level `reviewing-as-julianken-bot` skill (or your own equivalent) — that overlay owns how the bot loads its token and posts via the REST API. This doc intentionally does not restate those steps.
4. Dispatch the reviewer fresh-context on the [`reviewing`](../../.claude/skills/reviewing/SKILL.md) rubric; load the credential overlay only to *post* the gating verdict.

## Skip

If your repo's merge gate is satisfied by a human reviewer (or you run no required-review gate), you don't need a bot account. The [`reviewing`](../../.claude/skills/reviewing/SKILL.md) rubric still stands alone — a human applies it directly, posting an ordinary review. Adjust the ruleset and [`pr-workflow`](../../.claude/skills/pr-workflow/SKILL.md) so they don't assume a `@julianken-bot` poster, and the credential overlay is simply never loaded.
