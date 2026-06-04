# GAPS.md

A ledger of repo / Claude-setup capabilities **deliberately not built yet**, each with the trigger that should wake it. This is a pre-code, solo, client-side, AI-agent-built repo, so most tooling other repos carry would have nothing to act on yet — no dependency graph to scan, no UI to guard, no deadline to age against. This file records *why* each thing is absent and *what* should bring it back, so a deferred item resurfaces when its trigger fires instead of being silently forgotten or re-litigated.

Scope: the repo's tooling, CI, agents, skills, and process scaffolding. Not a product backlog — features/tools live in issues and `DESIGN.md`, not here.

This file is itself drift-prone, so it sits in the `AGENTS.md` “Keeping docs and drift-prone files current” Update Triggers logic: when a process or roadmap change fires or retires one of the triggers below, reconcile this file in the same PR. A row whose trigger has already fired but is still parked under “Deferred” is a finding — raise it the way that section says (a non-blocking IMPORTANT note, never a merge blocker). Don't restate `AGENTS.md`, `DESIGN.md`, or `SECURITY.md` here; cross-reference them.

---

## Deferred (build when the trigger fires)

Sibling repos referenced: `detached-node` (the blog, `julianken/detached-node`) and `bird-sight-system` (local `bird-watch`) — the two repos this setup was mined from. Note that most of `bird-watch`'s `.claude/` is per-developer and gitignored (`.gitignore` ignores `.claude/*` except `.claude/skills/`), so where it's cited below as a model, it's local scaffolding to learn from, not a committed file to copy.

| Item | Trigger that should wake it | Why deferred / modeled on |
| --- | --- | --- |
| Dependency hygiene: `knip` (dead-code/dep finder), grouped Dependabot config, lockfile sanity (`npm ci --dry-run`), `syncpack` | `package.json` + a build + source files land | Nothing to analyze until there's a dependency graph and a lockfile. |
| CI-gate `scripts/check-claude-shim.sh` as a path-filtered GitHub Actions job | The first GitHub Actions workflow exists | The shim guard runs by hand in review today; turn it into a job once there's a workflow file to host it. Mirrors `detached-node`'s `meta-rule-consistency.yml`. |
| Nightly LLM drift extractor + full `drift:*` label taxonomy (aging → escalated) + `SessionStart` surfacing + a kill-metric (e.g. 60-day / 40%) + quarterly re-audit | Code / deps / schema / CI **and** a dated deadline or aging-spec to scan | Pre-code there's nothing for it to scan, so it would emit noise. See the `detecting-drift-in-ai-repos` skill for the design when it activates. |
| Soft-launch → dated-flip → promote-to-blocker rollout ritual + allowlist-with-dated-expiry hygiene | The first non-shim **deterministic** CI check lands | No deterministic gate to roll out yet (the shim guard is the only check, and it's hand-run). |
| Commit-gated `PreToolUse` hooks (block `console.log` / debug artifacts), scoped to **code only, never `.md`** | There is shipping JS/TS | Nothing to lint-on-write yet; explicitly never gate prose/docs. |
| `.claude/settings.json` (committed, minimal) | There's a hook or plugin worth sharing repo-wide | A committed settings file with nothing in it is clutter. The paired per-developer ignore (`.claude/settings.local.json`) is being added now, in this batch, since it can stand alone before any committed settings exist. Modeled on `bird-watch`'s per-developer `settings.local.json` (which is gitignored there, not committed). |
| More repo agents/skills + an `agents/_patterns` crosswalk + a scoped sub-agent mode (e.g. a Dependabot reviewer) | Those agents/skills actually exist | The design-reviewer is the *first* agent; a patterns crosswalk and a Dependabot mode are premature with one agent and no deps. Both modeled on `bird-watch`'s local `.claude` scaffolding (`agents/_patterns.md`, `agents/dependabot.md` — gitignored there). |
| Housekeeping: ignore `.claude/worktrees/` + tear down agent worktrees as part of “done” | This repo first dispatches worktree-isolated agents | No worktrees are created here yet; `bird-watch` already ignores `.claude/worktrees/`. |

---

## Effectively-permanent skips (with reason)

These are not “later” — they're scoped *out* by what this project is. Listed so nobody re-proposes them as oversights. A skip only reopens if the stated reason stops being true.

| Skipped | Why it stays skipped |
| --- | --- |
| `oasdiff` / `openapi-diff` / `graphql-inspector` (API↔client schema drift) | `SECURITY.md` states there is no backend. No API surface to diff. Reopens only if a backend/API/schema is ever added. |
| `terraform-plan-drift-check` + `drift-allowlist.yml` + `filter-tf-drift.py` (infra↔live drift) | A pre-code, client-side static app owns no IaC or cloud infra to drift against, and `SECURITY.md` already treats the hosting provider / CDN / DNS as out of report-scope once a host is chosen. Reopens only if the repo ever owns infra. |
| `.mergify.yml` merge-queue | A branch ruleset requiring a fresh bot approval per HEAD + squash-merge already covers merge gating; this repo does **not** use Mergify and doesn't want the extra moving part for a one-maintainer cadence. |
| The ~190-entry `settings.local.json` permission allowlist | A copied mega-allowlist is unaudited surface; this repo grants permissions narrowly as real need appears. |
| Blog-specific prose-critic agent | That's a `detached-node` concern (a writing site). This is an app; a generic prose critic earns its keep nowhere here. (User-level voice tooling exists separately.) |
| Funnel-orchestration skills, heavy MCP / plugin surface | Orchestration-scale machinery for a focused single-app repo is overhead, not leverage. |
| Any `.md` / narrative-drift hook, or any merge-blocker on narrative drift | Doc-currency is handled as a **non-blocking** review convention in `AGENTS.md` (“Keeping docs and drift-prone files current”). Gating prose with a hook or a blocker contradicts that deliberate choice. |

---

## Already done (so the ledger shows the whole picture)

Not gaps — pointers to what's in place, so this file reads as a map and not a wish-list.

- **`SECURITY.md`** — private-reporting policy, scope, and the public-≠-auditable stance.
- **`LICENSE`** — MIT.
- **`AGENTS.md` + `CLAUDE.md` shim** — single source of truth + thin Claude-only shim, guarded by `scripts/check-claude-shim.sh` (run in review).
- **Doc-currency convention** — the `AGENTS.md` “Keeping docs and drift-prone files current” section + its Update Triggers table (this very file is one of its dependents).
- **`README.md`** — public-facing entry point (added alongside this ledger).
- **`.claude/agents/design-reviewer.md`** — the repo's first agent, grounded in `DESIGN.md`; indexed by `.claude/agents/README.md`.
- **`.claude/skills/pr-workflow/SKILL.md`** — repo-local PR/review/merge process for worktree-isolated subagents.
- **The v1 design spec** — `docs/superpowers/specs/2026-06-02-violin-scales-design.md` exists and is marked v1-final, so the AGENTS.md Update Triggers “behavior described by a spec” row is now live (its `(when specs exist)` caveat is dropped in the same batch as this ledger). `DESIGN.md` still wins on any design conflict.

_Reconcile this list against `ls` / `git status`, per `AGENTS.md` “Working in the tree” — not against this sentence._

