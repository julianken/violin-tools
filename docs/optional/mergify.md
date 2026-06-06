# Optional module — Mergify merge queue

**Optional.** This repo automates squash-merge through [Mergify](https://mergify.com/)'s merge queue. A template consumer can adopt it, swap in a different queue, or merge manually — the core PR process in [`AGENTS.md`](../../AGENTS.md) and [`.claude/skills/pr-workflow/SKILL.md`](../../.claude/skills/pr-workflow/SKILL.md) doesn't require it.

This doc is the *adopt-or-skip* narrative. It is **not** the source of truth for the queue mechanics: the live config is [`.mergify.yml`](../../.mergify.yml), and the merge *method* (the full queue rules, stuck-PR diagnosis, the canonical command flow) lives in `pr-workflow` and the user-level `mergify-merge-workflow` skill. Don't restate those here — point at them.

## What's in use today

- **Config:** [`.mergify.yml`](../../.mergify.yml) at the repo root.
- **Gate:** the queue gates on the approving review (`#approved-reviews-by >= 1`, `base = main`, `-draft`, `-conflict`) **and** the `gates` CI check (`check-success = gates` — typecheck/lint/test/build from `.github/workflows/ci.yml`); the branch ruleset requires the same `gates` status check (non-strict). Add further `check-success` lines (and matching required checks to the ruleset) as new workflows land (e.g. the S12 app-ci E2E/visual job).
- **Merge method:** `squash`.
- **Trigger:** post `@Mergifyio queue` as a **standalone** comment whose body is exactly those 16 characters. Mergify literal-matches the whole comment body; any prose or markdown wrapped around it is silently skipped (no reaction, the PR sits unqueued). Never `gh pr merge` once Mergify is live — that bypasses the queue.

## The three invariants

`.mergify.yml` keeps three settings that are load-bearing once strict required-checks exist — don't relax them without flipping branch protection in the same PR:

1. `merge_queue.max_parallel_checks: 1`
2. `queue_rules[].batch_size: 1`
3. a single `queue_conditions` block (no separate `merge_conditions`)

The rationale and the stuck-PR diagnosis are owned by the user-level `mergify-merge-workflow` skill — read it before editing the config.

## Bootstrap caveat

Mergify reads `.mergify.yml` from `main`. The PR that **first introduces or edits** the config therefore can't be merged by the queue it ships — merge that one with the repo's pre-Mergify fallback, then the queue governs subsequent PRs. Likewise, the queue is **inert until the Mergify GitHub App is granted access to the repo**; until then the config is parsed but no merge happens.

## Adopt

1. Add a `.mergify.yml` at the repo root (copy this repo's as a starting point; keep the three invariants).
2. Install the Mergify GitHub App and grant it access to the repo.
3. Set the queue conditions to your gate (this repo uses a single approving review; tighten to `approved-reviews-by = <reviewer>` if you have multiple collaborators).
4. Merge the bootstrap PR with your pre-Mergify fallback (see caveat), then use `@Mergifyio queue` for everything after.

## Skip

Delete `.mergify.yml` (or never add it) and merge however you like — `gh pr merge --squash`, the GitHub UI, or another merge queue. The only core dependency is that a PR still earns its review approval before merging (see [`pr-workflow`](../../.claude/skills/pr-workflow/SKILL.md)); the *queue* is the optional part. If you skip Mergify, update the merge step in `pr-workflow` so it doesn't tell agents to post `@Mergifyio queue`.
