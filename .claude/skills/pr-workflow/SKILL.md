---
name: pr-workflow
description: Use when creating a PR, dispatching a review, or merging on `julianken/violin-tools` (local folder `violin-scales/`). Triggers on "create PR", "open PR", "merge PR", "review PR", "dispatch the bot", "julianken-bot", "ship this branch", "squash-merge". Self-contained because a worktree-isolated subagent does NOT load CLAUDE.md / AGENTS.md, so the PR/review/merge rules it needs are restated here in-body. This repo does NOT use Mergify.
---

# PR workflow (julianken/violin-tools)

Local folder is `violin-scales/`; the GitHub slug is `julianken/violin-tools` — pass the **slug** to `gh`. Default branch `main`.

Direct push to `main` is blocked by a GitHub **ruleset** that requires a fresh approving review from `@julianken-bot` against the current HEAD. Every change lands via a PR that (1) fills the template's five sections, (2) earns a bot approval on the exact HEAD being merged, and (3) is **squash-merged**. There is **no Mergify** here — no queue, no `@Mergifyio` comment, no `.mergify.yml`. Squash-merge directly once the ruleset is satisfied.

## The four rules

1. **Fill all five template sections.** `.github/PULL_REQUEST_TEMPLATE.md` has Diagrams · Summary · Screenshots · Test plan · Plan/issue reference. GitHub does NOT inject the template on API-created PRs, so with `gh pr create --body` you must paste the template body and fill every section yourself. Never let `gh` open a blank web-template PR; never drop a section to save tokens. Use `N/A — <reason>` where a section genuinely doesn't apply; never delete a header. The Test plan carries a **doc-currency checkbox** — see rule 4.
2. **Review is dispatched to the bot; it posts via the REST API.** Two separate things, often conflated:
   - **Don't review from the main session — dispatch the user-level `reviewing-as-julianken-bot` subagent.** The main session's `gh` is authed as `@julianken`, so a review posted from it counts as Julian's, not the bot's, and can't satisfy the ruleset (which needs a `@julianken-bot` approval). The subagent runs fresh-context, reads the PR itself (`gh pr view` / `gh pr diff` — it never trusts the dispatcher's narrative), and reviews from a different model tier, which reduces the self-review bias of a model grading its own work.
   - **The bot posts via `gh api .../pulls/{n}/reviews -X POST`, not `gh pr review`.** `gh pr review` has no inline-comment support, and this review requires inline `file:line` findings; the REST API posts the verdict + inline comments in one call. The bot identity comes from a PAT loaded from the macOS Keychain per-call. Do not dispatch two agents to the same working tree at once.
3. **A bot approval is per-HEAD.** It applies only to the HEAD it reviewed. Any new commit pushed after approval (including a fix prompted by review) invalidates it — re-dispatch the bot on the new HEAD. Merge only when `gh pr view <N> --json reviewDecision` reads `APPROVED` against the current HEAD.
4. **Doc-currency before the PR (and the reviewer checks it).** Before opening, update — in the same PR — every drift-prone file your change affects, per **the Update Triggers table in `AGENTS.md`** (the source of truth for which file maps to which kind of change; don't carry a second copy of that mapping here). `DESIGN.md` wins on any design conflict. If `CLAUDE.md` or `AGENTS.md` changed, confirm `scripts/check-claude-shim.sh` still passes. If nothing applies, write `No doc updates needed` in the Summary. Tick the Test-plan doc-currency box (`N/A — <reason>` is fine). A missed doc is an IMPORTANT finding with an escape hatch — **not** a merge blocker.

## End-to-end flow

```
feature branch  →  gh pr create (fill the five sections)
                          │
            dispatch reviewing-as-julianken-bot subagent
                          │
                  fresh APPROVED vs HEAD?  ──no──►  fix · push · re-dispatch
                          │ yes
         gh pr merge --squash --match-head-commit <HEAD-sha>
```

1. Make changes on a feature branch. Conventional-commit prefix (`feat(scope):`, `fix:`, `chore:`, `docs:` …). Bodies explain *why*. No git trailer is configured — append `Co-Authored-By: <model> <noreply@anthropic.com>` by hand, matching the authoring model.
2. Update affected drift-prone docs in the same branch (rule 4).
3. `gh pr create --repo julianken/violin-tools --body "$(cat <<'EOF' … EOF)"` — paste the template body and fill every section. `Plan/issue reference` links the issue/plan or says `Out of plan — <reason>`. `Screenshots` is REQUIRED when the diff adds or modifies visible UI (otherwise `N/A — not UI`).
4. Dispatch the `reviewing-as-julianken-bot` subagent. Do NOT call `gh pr review` yourself (rule 2).
5. Address findings; if you push commits, re-dispatch the bot (rule 3). Cycle to a clean `APPROVED` on the current HEAD.
6. Merge — squash, with a server-side HEAD check, no branch flag:
   ```bash
   CURRENT_HEAD=$(gh pr view <N> --repo julianken/violin-tools --json headRefOid --jq .headRefOid)
   gh pr merge <N> --repo julianken/violin-tools --squash --match-head-commit "$CURRENT_HEAD"
   ```
   `--match-head-commit` makes GitHub reject the merge if HEAD moved since you checked (catches a late push). No `--delete-branch` — the repo's `delete_branch_on_merge` setting handles branch cleanup. No `--auto` (the `--auto --delete-branch` combo has a known gh bug) and no `--admin`. The canonical merge mechanics, pre-merge gates, and post-merge branch sweep live in the `reviewing-as-julianken-bot` skill's `merge-flow.md`.

## Screenshots — never committed

When the PR adds or modifies visible UI, upload screenshots via the user-level `pr-screenshots-via-user-attachments` skill: simulated paste into the GitHub web textarea produces `user-attachments/assets/<uuid>` URLs that are CDN-hosted, repo-independent, and survive branch deletion. **Do NOT commit PNGs** and **do NOT use `raw.githubusercontent.com`** branch-relative URLs — they 404 once the branch is deleted on merge. That skill and the PR template specify the capture viewports and the `DESIGN.md` match to confirm. Pre-code there is no running UI yet — this activates once a UI exists; until then `Screenshots: N/A — not UI`.

## Tripwires

- **No Mergify queue exists.** Don't post `@Mergifyio queue`, don't look for `.mergify.yml`. After a fresh bot approval, squash-merge directly (step 6).
- **`DESIGN.md` wins on any design conflict.** Reconcile it in the same PR rather than letting a token/motion/layout change drift away from it.
- **The CLAUDE.md shim is guarded** by `scripts/check-claude-shim.sh` (it fails if CLAUDE.md becomes a symlink, drops the bare `@AGENTS.md` line, gains a code fence or any H2 other than `## Claude Code only`, or exceeds 25 lines). If a PR touches `CLAUDE.md` or `AGENTS.md`, run it and confirm it passes.

## Ownership

This repo skill is the entry point worktree-isolated subagents and non-Claude tools read for the violin-tools PR/review/merge process; the user-level skills (`creating-prs`, `reviewing-as-julianken-bot`, `pr-screenshots-via-user-attachments`) are shared across Julian's repos. `mergify-merge-workflow` does **not** apply here. If you can read `AGENTS.md`, its **Skill ownership** section is authoritative for which copy wins on conflict and the same-PR update rule that keeps the two from drifting; if you can't (worktree-isolated), the short version is: anything violin-tools-specific (merge mechanics, the ruleset, what's in our template) is owned here, the shared method is owned by the user-level skills, and a change to either copy must update the other in the same PR.

