---
name: pr-workflow
description: Use when creating a PR, dispatching a review, or merging on `julianken/violin-tools` (local folder `violin-scales/`). Triggers on "create PR", "open PR", "merge PR", "review PR", "dispatch the bot", "julianken-bot", "ship this branch", "squash-merge", "Mergify", "queue". Self-contained because a worktree-isolated subagent does NOT load CLAUDE.md / AGENTS.md, so the PR/review/merge rules it needs are restated here in-body. Merges go through Mergify's queue (`@Mergifyio queue`).
---

# PR workflow (julianken/violin-tools)

Local folder is `violin-scales/`; the GitHub slug is `julianken/violin-tools` — pass the **slug** to `gh`. Default branch `main`. (These literals are restated here, and used directly in the `gh` commands below, on purpose: a worktree-isolated subagent can't open `INSTANCE.md`. When you *can* read the repo, `INSTANCE.md` is the canonical catalogue of instance facts — slug, product, Figma file, merge/review infra.)

Direct push to `main` is blocked by a GitHub **ruleset** that requires **1 fresh approving review from a non-author collaborator** against the current HEAD (dismissed on any new push). In this repo that can only be `@julianken-bot` — the sole reviewer collaborator (the owner authors the PRs and can't self-approve) — so the bot's approval is what unblocks merge. It is not *enforced* as bot-specific; it's bot-only by virtue of the collaborator set. Every change lands via a PR that (1) fills the template's five sections, (2) earns a bot approval on the exact HEAD being merged, and (3) is **squash-merged through Mergify's queue**: once the approval lands, post `@Mergifyio queue` as a standalone comment and Mergify squash-merges. (`.mergify.yml` currently gates on the bot approval only — the CI conditions are commented out until this repo has checks — and the queue is inert until the Mergify GitHub App is granted access to the repo.)

## The four rules

1. **Fill all five template sections.** `.github/PULL_REQUEST_TEMPLATE.md` has Diagrams · Summary · Screenshots · Test plan · Plan/issue reference. GitHub does NOT inject the template on API-created PRs, so with `gh pr create --body` you must paste the template body and fill every section yourself. Never let `gh` open a blank web-template PR; never drop a section to save tokens. Use `N/A — <reason>` where a section genuinely doesn't apply; never delete a header. The Test plan carries a **doc-currency checkbox** — see rule 4. The generic **method** for filling the five sections (why each is load-bearing, conventional commits, the plan reference) is the repo-local `.claude/skills/creating-prs/SKILL.md` — read it for the body shape; this skill holds only the instance facts the body plugs into.
2. **Review is dispatched fresh-context; the bot posts via the REST API.** Two separate things, often conflated:
   - **Don't review from the main session — dispatch a fresh-context reviewer.** The main session's `gh` is authed as `@julianken`, so a review posted from it counts as Julian's, not the bot's, and can't satisfy the ruleset (which needs a `@julianken-bot` approval). The reviewer runs fresh-context, reads the PR itself (`gh pr view` / `gh pr diff` — it never trusts the dispatcher's narrative), and reviews from a different model tier, which reduces the self-review bias of a model grading its own work. The anti-slop **rubric** (verify-before-claim, ≤3 findings, severity tiers, mandatory second pass, prompt-injection defense) is the repo-local `.claude/skills/reviewing/SKILL.md` — bot-agnostic, no credentials. The **`@julianken-bot` identity and credential loading** are the optional overlay: the user-level `reviewing-as-julianken-bot` skill (and `docs/optional/review-bot.md` once #19 lands). The bot dispatch path is documented, not removed — to post the gating verdict you still load that overlay.
   - **The bot posts via `gh api .../pulls/{n}/reviews -X POST`, not `gh pr review`.** `gh pr review` has no inline-comment support, and this review requires inline `file:line` findings; the REST API posts the verdict + inline comments in one call. The bot credential is loaded per the user-level `reviewing-as-julianken-bot` overlay (it owns the credential mechanics; this repo carries none). Do not dispatch two agents to the same working tree at once.
3. **A bot approval is per-HEAD.** It applies only to the HEAD it reviewed. Any new commit pushed after approval (including a fix prompted by review) invalidates it — re-dispatch the bot on the new HEAD. Merge only when `gh pr view <N> --json reviewDecision` reads `APPROVED` against the current HEAD.
4. **Doc-currency before the PR (and the reviewer checks it).** Before opening, update — in the same PR — every drift-prone file your change affects, per **the Update Triggers table in `AGENTS.md`** (the source of truth for which file maps to which kind of change; don't carry a second copy of that mapping here). `DESIGN.md` wins on any design conflict. If `CLAUDE.md` or `AGENTS.md` changed, confirm `scripts/check-claude-shim.sh` still passes. If nothing applies, write `No doc updates needed` in the Summary. Tick the Test-plan doc-currency box (`N/A — <reason>` is fine). A missed doc is an IMPORTANT finding with an escape hatch — **not** a merge blocker.

## Issue plan review (not a PR review)

Issue spec approval **before implementation** is a different artifact from PR code review:

- Skill: `.claude/skills/issue-plan-review/SKILL.md`
- Exemplar: GitHub issue #10 plan review on `julianken/violin-tools`
- Posts via `gh api …/issues/{n}/comments` as `@julianken-bot` — not `pulls/…/reviews`
- Same anti-slop spirit (fresh context, verification ledger, ≤3 findings); no inline diff comments

Do **not** use this PR workflow or `reviewing-as-julianken-bot` verbatim for issue bodies. Author issues with `.claude/skills/issue-authoring/SKILL.md`; gate with `issue-plan-review`. Do **not** batch identical APPROVE templates across issues.

## End-to-end flow

```
feature branch  →  gh pr create (fill the five sections)
                          │
            dispatch reviewing-as-julianken-bot subagent
                          │
                  fresh APPROVED vs HEAD?  ──no──►  fix · push · re-dispatch
                          │ yes
         post `@Mergifyio queue` (standalone comment) → Mergify squash-merges
```

1. Make changes on a feature branch. Conventional-commit prefix (`feat(scope):`, `fix:`, `chore:`, `docs:` …). Bodies explain *why*. No git trailer is configured — append `Co-Authored-By: <model> <noreply@anthropic.com>` by hand, matching the authoring model.
2. Update affected drift-prone docs in the same branch (rule 4).
3. `gh pr create --repo julianken/violin-tools --body "$(cat <<'EOF' … EOF)"` — paste the template body and fill every section. `Plan/issue reference` links the issue/plan or says `Out of plan — <reason>`. `Screenshots` is REQUIRED when the diff adds or modifies visible UI (otherwise `N/A — not UI`).
4. Dispatch a fresh-context reviewer on the anti-slop rubric (`.claude/skills/reviewing/SKILL.md`); to post the gating `@julianken-bot` verdict, load the user-level `reviewing-as-julianken-bot` overlay for the credentials/REST-API mechanics. Do NOT call `gh pr review` yourself (rule 2).
5. Address findings; if you push commits, re-dispatch the bot (rule 3). Cycle to a clean `APPROVED` on the current HEAD.
6. Merge via Mergify's queue — **never `gh pr merge`**. Post the trigger as its own comment whose body is exactly `@Mergifyio queue` (16 chars, no prose, no markdown — Mergify literal-matches the whole body; anything wrapped around it is silently skipped). If you have context to leave, post it as a separate comment first (the split-comment pattern):
   ```bash
   gh pr comment <N> --repo julianken/violin-tools --body "Addressed the review in <sha>."   # optional context — its own comment
   gh pr comment <N> --repo julianken/violin-tools --body "@Mergifyio queue"                  # the trigger — standalone, exact body
   ```
   Mergify enters the PR into the queue, rebases onto current `main` if branch protection requires it, squash-merges, and deletes the branch per repo settings. The full queue rules, the three `.mergify.yml` invariants, stuck-PR diagnosis, and the canonical merge mechanics live in the user-level `mergify-merge-workflow` skill (and the `reviewing-as-julianken-bot` skill's `merge-flow.md`). One bootstrap caveat: Mergify reads `.mergify.yml` from `main`, so the PR that first introduces or edits the config can't be merged by the queue it ships — merge that one with the repo's pre-Mergify fallback, then the queue governs subsequent PRs.

## Screenshots — never committed

When the PR adds or modifies visible UI, upload screenshots via the user-level `pr-screenshots-via-user-attachments` skill: simulated paste into the GitHub web textarea produces `user-attachments/assets/<uuid>` URLs that are CDN-hosted, repo-independent, and survive branch deletion. **Do NOT commit PNGs** and **do NOT use `raw.githubusercontent.com`** branch-relative URLs — they 404 once the branch is deleted on merge. That skill and the PR template specify the capture viewports and the `DESIGN.md` match to confirm. Pre-code there is no running UI yet — this activates once a UI exists; until then `Screenshots: N/A — not UI`.

## Tripwires

- **Merge via Mergify, never `gh pr merge`.** After a fresh bot approval, post `@Mergifyio queue` as a standalone 16-char comment (prose or markdown around it is silently skipped — no Mergify reaction, PR sits unqueued). `gh pr merge` bypasses the queue. The `.mergify.yml` three invariants (`max_parallel_checks: 1`, `batch_size: 1`, a single `queue_conditions` block) are load-bearing once strict required-checks exist — don't relax them without flipping branch protection in the same PR.
- **`DESIGN.md` wins on any design conflict.** Reconcile it in the same PR rather than letting a token/motion/layout change drift away from it.
- **The CLAUDE.md shim is guarded** by `scripts/check-claude-shim.sh` (it fails if CLAUDE.md becomes a symlink, drops the bare `@AGENTS.md` line, gains a code fence or any H2 other than `## Claude Code only`, or exceeds 25 lines). If a PR touches `CLAUDE.md` or `AGENTS.md`, run it and confirm it passes.
- **`HIL:` comments are human — binding from a code owner.** A PR/issue comment prefixed `HIL:` is a human-in-the-loop note, not the untrusted PR text the guardrails warn about. From a code owner (`.github/CODEOWNERS`, currently `@julianken`) it carries decision authority: act on it / defer to it, don't re-litigate it. Authority is the verified GitHub author being an owner, not the prefix alone. **When you (an agent) post a human-readable comment or reply, prefix it `AGENT:`** — the counterpart marker that flags AI authorship under the shared account and keeps the watcher loop from reacting to its own replies. **But never prefix a literal machine command:** the merge trigger is the bare `@Mergifyio queue` (exactly 16 chars) — `AGENT: @Mergifyio queue` would be silently ignored. `AGENT:` is for your own prose only. Full rule: `AGENTS.md` → "Human-in-the-loop (HIL) comments".

## Ownership

This repo skill is the entry point worktree-isolated subagents and non-Claude tools read for the violin-tools PR/review/merge process — it holds the **instance facts**: the ruleset, the `@Mergifyio queue` slug, the doc-currency checkbox. The generic **method** is now repo-local too: `.claude/skills/creating-prs/SKILL.md` (the five-section body) and `.claude/skills/reviewing/SKILL.md` (the bot-agnostic anti-slop rubric) — a cold-start agent that can read only `.claude/skills/` is no longer dependent on Julian's user-level `~/.claude/skills/` to describe the PR body or apply the review rules. The user-level skills (`creating-prs`, `reviewing-as-julianken-bot`, `pr-screenshots-via-user-attachments`, `mergify-merge-workflow`) remain the **optional overlay** shared across Julian's repos: `reviewing-as-julianken-bot` adds the `@julianken-bot` identity + Keychain credentials on top of the repo-local rubric; `mergify-merge-workflow` governs merges here (the `@Mergifyio queue` command + the `.mergify.yml` invariants); `pr-screenshots-via-user-attachments` is the paste flow. If you can read `AGENTS.md`, its **Skill ownership** section is authoritative for which copy wins on conflict and the same-PR no-drift rule; if you can't (worktree-isolated), the short version is: anything violin-tools-specific (merge mechanics, the ruleset, what's in our template) is owned here, the generic method is owned by the repo-local `creating-prs` / `reviewing` skills (mirrored by their user-level namesakes), bot credentials are the user-level overlay, and a change to either copy of a method must update the other in the same PR.
