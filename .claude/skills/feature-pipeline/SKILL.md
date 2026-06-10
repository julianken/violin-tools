---
name: feature-pipeline
description: >
  Triggers on intent-to-run-the-pipeline phrases. Use when the user says
  "run the feature pipeline", "start the pipeline for X", "kick off the
  orchestration", "automate feature X end-to-end", "feature pipeline",
  "run the pipeline for X", "start the orchestration", or "pipeline a new feature".
  Does NOT trigger on "create an issue", "review a PR", "open a PR",
  "merge a branch", or "deploy" — those stay in their own skills.
---

# Feature Pipeline — driving skill

**Announce at start:** *"I'm using the feature-pipeline skill to run the automated feature pipeline."*

This is the **human-facing entry point** for the feature pipeline system. It makes the P5 engine (`.claude/workflows/feature-pipeline.js`) discoverable and correctly invocable by a fresh agent. It does NOT duplicate the engine logic — it documents the args contract, the front-door brainstorm, and the stage map so a cold-start worktree-isolated agent is self-contained.

---

## Hard constraints (restated for worktree isolation)

These constraints are restated here in full because worktree-isolated agents do NOT load `AGENTS.md` — this skill is their sole instruction surface.

- **Repo slug:** `julianken/violin-tools`; local folder is `violin-scales/`.
- **Engine path:** `.claude/workflows/feature-pipeline.js` — a saved Claude Code Workflow script; invoke it via the Workflow tool, NOT as a shell command.
- **No human pauses mid-run.** The engine runs fully autonomously. All review gates are dispatched as fresh-context `@julianken-bot` subagents. Blockers go to a RESOLUTION sub-workflow (diagnose→fix→verify). The engine escalates a `HIL:` note only for a genuine info-need or a truly-unresolvable problem (≥2 failed RESOLUTION cycles on the same blocker, or a missing arg only the owner can supply).
- **RESOLUTION sub-workflow** (diagnose→fix→verify): when a phase encounters a blocker (failed gate, build error, bot REQUEST_CHANGES with no actionable fix path), the engine dispatches a resolution sub-workflow: (1) diagnose — read the error/finding, identify root cause; (2) fix — apply the minimal change; (3) verify — confirm the fix satisfies the gate before re-dispatching. Only after ≥2 failed RESOLUTION cycles on the same blocker does the engine emit a `HIL:` escalation note and halt the affected phase.
- **Model routing:** opus for review gates and synthesis stages; sonnet for mechanical stages (issue fan-out, PR-body fill). A `model` arg overrides only the mechanical-stage tier; review gates always use opus regardless.
- **Worktree policy:** every change runs in a linked git worktree; never commit on `main`.
- **Never commit briefs, plans, or `tmp/` content.** Plans live in gitignored `tmp/docs/`, never in `docs/plans/` or any committed path.
- **Bot identity:** `@julianken-bot` posts reviews; the main session never runs `gh pr review` (that posts as `@julianken` and fails the per-HEAD branch ruleset).

---

## One-HIL-pause framing

The **autonomous run** (the engine) has **zero mid-run pauses** — the engine never blocks for the human. The single HIL touchpoint is the FRONT-DOOR brainstorm (phase 0, below), which runs **in the MAIN session BEFORE the engine is invoked**. So the model is:

- **Human-IN-the-loop** for the irreversible product decision (front-door brainstorm, main session, phase 0).
- **Human-ON-the-loop** for everything after (watch the dashboard; intervene only via a `HIL:` comment when the engine escalates a true info-need).

---

## Phase 0 — FRONT-DOOR brainstorm (runs in MAIN session, before the engine)

The Workflow runtime cannot take mid-run input, so the brainstorm **cannot** run inside `feature-pipeline.js`. Before invoking the engine, the driving skill runs the one sanctioned HIL touchpoint in the MAIN session:

1. **Invoke `superpowers:brainstorming`** — one question at a time, propose 2–3 approaches, present a design, HARD-GATE on the user's approval before any implementation.
2. **On approval, write the brief** to the GITIGNORED path `tmp/docs/<featureSlug>-brief.md` — NOT `docs/superpowers/specs/` (the brainstorming skill's committed-spec default). This is a one-line documented INSTANCE ADAPTATION: `superpowers:brainstorming` explicitly honors "User preferences for spec location override this default", and we do NOT invoke its terminal writing-plans step (epic-authoring is our downstream). The brief is written to the gitignored `tmp/docs/` path; it is never committed.
3. **Pass `brainstormBriefPath`** (the path to the brief) as a start arg to the engine. The brief is immutable start input the engine only READS — the standard "no mid-run Update primitive ⇒ externalize the human decision as a start arg" resolution.

### Brief required-field shape

The brief at `tmp/docs/<featureSlug>-brief.md` must contain these fields (fixed-field, literal-minded-parseable):

- **`PROBLEM`** — one-paragraph user-facing goal.
- **`SCOPE-IN`** — explicit bullet list of what is in scope (the YAGNI boundary).
- **`SCOPE-OUT`** — explicit bullet list of what is explicitly out of scope.
- **`SUCCESS CRITERIA`** — observable/testable outcomes that seed the epic's acceptance criteria.
- **`CONSTRAINTS`** — design/token/perf/a11y/platform constraints, pointing at `DESIGN.md` where relevant.
- **`uiFeature:`** — on its OWN greppable line, exactly `uiFeature: yes` or `uiFeature: no` plus a one-line justification. Matched with `grep -F`, no NLP. This is load-bearing: the engine reads it at phase 1 to set the `uiFeature` flag.

Example brief fragment:
```
PROBLEM
One paragraph describing the user-facing goal.

SCOPE-IN
- Item 1
- Item 2

SCOPE-OUT
- Item A
- Item B

SUCCESS CRITERIA
- Observable outcome 1
- Observable outcome 2

CONSTRAINTS
- See DESIGN.md §0 for token values
- a11y: WCAG 2.1 AA

uiFeature: yes  <!-- adds visible UI to the note map -->
```

---

## Args contract

The engine requires Claude Code v2.1.154+ for schema-driven arg prompting (automatic prompting for missing required args). If your version is older, pass all args explicitly in the Workflow invocation — the engine will not prompt you.

Eight args total (five required, three optional):

| Arg | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `featureSlug` | string | **required** | — | Kebab-case identifier for the feature, e.g. `pipeline-infra`. Keys stage cards in `pipeline.json`. |
| `epicSpecPath` | string | **required** | — | Absolute path to the gitignored `tmp/docs/` epic spec the epic-authoring phase will use (or has used). |
| `childSpecPaths` | string[] | **required** | — | Ordered list of absolute `tmp/docs/` spec paths for child issues, dependency-ordered. Children are created first; epic is created last (so the epic can link finalized child numbers). |
| `repoSlug` | string | **required** | — | GitHub `owner/repo` slug. For this instance: `julianken/violin-tools`. |
| `brainstormBriefPath` | string | **required** | — | Absolute path to `tmp/docs/<featureSlug>-brief.md` produced by the front-door brainstorm (phase 0). **NOT a prompt-fill arg** — the schema-driven missing-arg prompt EXCLUDES `brainstormBriefPath`; the front-door brainstorm is its sole producer. Never ask the user for a path; run the brainstorm to produce it. |
| `uiFeature` | boolean | optional | derived from brief | Explicit override. The engine DERIVES it at phase 1 from the brief's `uiFeature: yes\|no` marker; this arg forces it. Drives the conditional Figma design+review phases (3 & 4) and the Figma-Design-Verdict gate before fan-out. |
| `model` | string | optional | per-phase routing | Override model tier. Accepts `'opus'` \| `'sonnet'` \| a full model id. When omitted, the engine applies per-phase routing (opus for review/synthesis stages, sonnet for mechanical stages); a supplied value overrides only the mechanical-stage tier — review gates always use opus. |
| `dryRun` | boolean | optional | `false` | When `true`, logs each phase decision without mutating GitHub state (no issues created, no PRs opened, no reviews posted, no merges triggered). Use for rehearsal or testing the pipeline wiring without side-effects. |

> **`brainstormBriefPath` is NOT a prompt-fill arg.** The schema-driven missing-arg prompt excludes it. The only way to produce it is the front-door brainstorm (phase 0, above). Never satisfy it by asking the user for a path.

---

## Stage map (twelve phases, zero engine pauses)

Phase 0 is the FRONT-DOOR (main session, before engine invocation). Phases 1–11 are the engine's autonomous run. Phases 3 and 4 are UI-only (skipped when `uiFeature == no`).

| Phase | Title | What it does | Leaf worker | Gate |
|-------|-------|--------------|-------------|------|
| 0 | Brainstorm (FRONT-DOOR / HIL) | The one sanctioned human touchpoint, in the MAIN session BEFORE the engine: one question at a time, propose 2–3 approaches, present a design, HARD-GATE on approval; write the brief to gitignored `tmp/docs/<featureSlug>-brief.md`; pass `brainstormBriefPath` | `superpowers:brainstorming` (front-door, not an engine leaf) | HARD-GATE on user approval (inside the brainstorming skill); the brief file existing IS the artifact the engine validates |
| 1 | Validate | Brief-validate (`brainstormBriefPath` exists + parses + carries the `uiFeature:` marker; set the `uiFeature` flag; absent ⇒ `AGENT: brainstorm needed` + halt, never conduct the brainstorm) **and** `project-bootstrap` validate-mode (slug, skills, agents present; `pipeline.json` + `feature-pipeline.schema.json` on main) | `.claude/skills/project-bootstrap/SKILL.md` (validate mode) + engine-local brief check; model: sonnet | None — abort/escalate on failure |
| 2 | Epic authoring | CONSUMES the brief; deep-research synthesis → `tmp/docs/` epic spec; carries `uiFeature` into the spec | `.claude/skills/epic-authoring/SKILL.md`; model: opus | None — produces the draft spec |
| 3 | Figma design (UI-only) | Build/modify the feature's WIP-page frames from the epic spec's SCOPE-IN + CONSTRAINTS, placing DESIGN.md §0 token values, idempotently | `.claude/skills/figma-design/SKILL.md`; model: opus | None — produces the WIP frames (skipped if `uiFeature == no`) |
| 4 | Figma design review (UI-only) | `@julianken-bot` loaded with `reviewing-figma-designs` reviews the WIP frames; writes `Figma-Design-Verdict` to the verdict file; REQUEST_CHANGES loops back to phase 3 | `.claude/skills/reviewing-figma-designs/SKILL.md`; `.claude/agents/julianken-bot.md`; model: opus | `Figma-Design-Verdict: APPROVE` in the verdict file (skipped/auto-satisfied if `uiFeature == no`) |
| 5 | Issue fan-out | Creates child issues first, then the epic last (so the epic links finalized child numbers); UI children reference the approved WIP frames by node-id | `.claude/skills/issue-authoring/SKILL.md`; model: sonnet | ENTRY precondition (UI features): the Figma verdict file reads APPROVE before any issue is created |
| 6 | Plan-review gate | `@julianken-bot` reviews each child issue, then epic LAST; loops REQUEST_CHANGES→fix→re-dispatch until APPROVED vs comment thread | `.claude/skills/issue-plan-review/SKILL.md`; `.claude/agents/julianken-bot.md`; model: opus | All issues APPROVED (epic last) |
| 7 | Implement | Parallel implementer dispatch (dependency-ordered); each implementer works in its own linked worktree on a feature branch | Subagent per child issue | None — parallel agents |
| 8 | Create PRs | Each implementer opens a PR filling all five template sections; UI PRs attach screenshots before review | `.claude/skills/creating-prs/SKILL.md`; `pr-screenshots-via-user-attachments`; model: sonnet | None — PR open |
| 9 | Review loop | `@julianken-bot` reviews each PR (model: opus); parallel with design-reviewer on UI PRs; loops REQUEST_CHANGES→fix→push→re-dispatch-on-new-HEAD until APPROVED vs HEAD | `.claude/skills/reviewing/SKILL.md`; `.claude/agents/julianken-bot.md`; `.claude/agents/design-reviewer.md` (UI PRs); model: opus for gates | `reviewDecision == APPROVED` per current HEAD (polled via gh) |
| 10 | Merge | Posts `@Mergifyio queue` standalone comment once APPROVED vs HEAD; Mergify squash-merges | `.claude/skills/pr-workflow/SKILL.md` | `mergedAt` set (polled via gh) |
| 11 | Deploy | `deploy.yml` fires on push to `main`; workflow polls until green | gh `statusCheckRollup` | All checks green |

---

## Epic-last gate

**Children before epic — always.** This invariant is enforced as a machine-readable gate in the engine AND stated here for human and cold-start-agent comprehension:

1. **Epic is created AFTER all children** — so the epic can link finalized child issue numbers (children are created at phase 5, epic is the final item in that same phase).
2. **Epic plan review runs LAST** — after all children are APPROVED by `@julianken-bot` (phase 6).
3. **Epic is closed LAST** — after all child PRs have `mergedAt` set (phase 10 completes for all children before the epic issue is closed).

No phase 5–10 action targets the epic until the children it describes are already stable.

---

## Resolution-not-HIL policy (restated for worktree isolation)

When a phase encounters a blocker (a failed gate, a build error, a bot REQUEST_CHANGES with no actionable fix path), the engine dispatches a **RESOLUTION sub-workflow**:

1. **Diagnose** — read the error/finding, identify root cause.
2. **Fix** — apply the minimal change.
3. **Verify** — confirm the fix satisfies the gate before re-dispatching.

Only after **≥2 failed RESOLUTION cycles on the same blocker**, or when the blocker is a genuine info-need (e.g. a missing arg only the owner can supply), does the engine emit a `HIL:` escalation note and halt the affected phase.

The human-ON-the-loop posture: watch the dashboard (`tools/pipeline-dashboard/pipeline.json`); intervene only via a `HIL:` comment when the engine escalates. Do not monitor progress by re-invoking the engine.

---

## Trigger testing

### Should trigger this skill (≥8 examples)

1. "run the feature pipeline"
2. "start the pipeline for the tuner"
3. "kick off the orchestration for scale labels"
4. "automate the horizontal map feature end-to-end"
5. "feature pipeline"
6. "run the pipeline for the ref-overlay feature"
7. "start the orchestration for the mobile redesign"
8. "pipeline a new feature"
9. "use the feature pipeline to ship the settings panel"
10. "invoke the pipeline workflow for dark mode"

### Should NOT trigger this skill (≥8 examples)

1. "create an issue for the tuner feature" → use `.claude/skills/issue-authoring/SKILL.md`
2. "review this PR" → use `.claude/skills/reviewing/SKILL.md`
3. "open a PR for branch feat/x" → use `.claude/skills/creating-prs/SKILL.md`
4. "merge branch feat/x" → use `.claude/skills/pr-workflow/SKILL.md`
5. "deploy to production" → use `deploy.yml` / infra
6. "what are the open issues?" → use `gh issue list`
7. "review the figma designs for the tuner" → use `.claude/skills/reviewing-figma-designs/SKILL.md`
8. "run the brainstorm for scale labels" → use `superpowers:brainstorming` directly (phase 0 only)
9. "bootstrap the project" → use `.claude/skills/project-bootstrap/SKILL.md`
10. "author the epic for S14" → use `.claude/skills/epic-authoring/SKILL.md`

---

## References

- **Engine:** `.claude/workflows/feature-pipeline.js` — the saved Workflow script this skill invokes.
- **Stage taxonomy:** `tools/pipeline-dashboard/pipeline.json` — the machine-readable source of truth for stage names, phase ids, and status values.
- **Schema:** `.claude/workflows/schemas/feature-pipeline.schema.json` — the JSON Schema for the args contract.
- **Review rubric:** `.claude/skills/reviewing/SKILL.md` — bot-agnostic anti-slop rubric used by all `@julianken-bot` review gates.
- **Issue authoring:** `.claude/skills/issue-authoring/SKILL.md` — shape for implementation issues created at phase 5.
- **Plan review:** `.claude/skills/issue-plan-review/SKILL.md` — gate rubric used at phase 6.
- **PR method:** `.claude/skills/creating-prs/SKILL.md` — five-section PR body discipline used at phase 8.
- **Instance facts + merge:** `.claude/skills/pr-workflow/SKILL.md` — the `@Mergifyio queue` trigger and ruleset facts.

---

## No-drift mirror note

This skill is NOT one of the paired no-drift skill copies tracked in `AGENTS.md` § Skill ownership (those are `creating-prs` ↔ user-level `creating-prs` and `reviewing` ↔ user-level `reviewing-as-julianken-bot`). A user-level `feature-pipeline` namesake does not exist at time of authoring. If one is created later, the no-drift rule applies from that point: changes to either copy must update the other in the same PR, and the PR Summary must say so.
