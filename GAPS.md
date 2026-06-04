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
| Soft-launch → dated-flip → promote-to-blocker rollout ritual + allowlist-with-dated-expiry hygiene | The first non-shim **deterministic** CI check lands | No deterministic gate to roll out yet (the shim guard is the only check, and it's hand-run). |
| Commit-gated `PreToolUse` hooks (block `console.log` / debug artifacts), scoped to **code only, never `.md`** | There is shipping JS/TS | Nothing to lint-on-write yet; explicitly never gate prose/docs. |
| `.claude/settings.json` (committed, minimal) | There's a hook or plugin worth sharing repo-wide | A committed settings file with nothing in it is clutter. The paired per-developer ignore (`.claude/settings.local.json`) is being added now, in this batch, since it can stand alone before any committed settings exist. Modeled on `bird-watch`'s per-developer `settings.local.json` (which is gitignored there, not committed). |
| More repo agents/skills + an `agents/_patterns` crosswalk + a scoped sub-agent mode (e.g. a Dependabot reviewer) | Those agents/skills actually exist | The design-reviewer is the *first* agent; a patterns crosswalk and a Dependabot mode are premature with one agent and no deps. Both modeled on `bird-watch`'s local `.claude` scaffolding (`agents/_patterns.md`, `agents/dependabot.md` — gitignored there). |

