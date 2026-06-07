# `.claude/agents/` — Subagent index for `violin-tools`

This directory holds repo-specific subagents for `julianken/violin-tools`
(local folder `violin-scales/`). They are dispatchable via the `Task` tool from a
session running at the repo root. The slug/folder are restated here on purpose —
worktree-isolated dispatches don't load `AGENTS.md`/`INSTANCE.md`; the canonical
catalogue of instance facts (product, slug, Figma file, merge/review infra) is
`INSTANCE.md`.

## Agents

| Agent | Purpose | When to dispatch |
|---|---|---|
| [`design-reviewer`](design-reviewer.md) | Review a change against the DESIGN.md design system (tokens, color/contrast, type, spacing, motion, the note-map SVG, a11y); also verifies transitions-dev usage on motion/interaction surfaces (AGENTS.md → UI & motion tooling); Playwright screenshot pass once a UI exists | "review the design surface", "does this match the spec", "design-system review pass" on any token/UI diff |
| [`julianken-bot`](julianken-bot.md) | Discoverability shim for `@julianken-bot` review dispatch — routes PRs to the repo `reviewing` rubric + user `reviewing-as-julianken-bot` (bot identity/credentials), issues to repo `issue-plan-review` | "review the PR", "dispatch the bot", "approve the issue spec", "plan review on issue #N" |

The design-reviewer runs **alongside** the correctness review, not instead of it.
`julianken-bot` routes to the skill that matches the artifact; it does not invent a
third rubric. PR review applies the repo-local `reviewing` rubric and posts the gating
verdict via the user-level `reviewing-as-julianken-bot` overlay (bot identity/credentials);
issue plan review posts via `issue-plan-review`.

## How a skill or session dispatches an agent

```
Task tool, subagent_type: design-reviewer | julianken-bot
Prompt: <minimal context only — PR or issue number, repo slug, working directory>
```

The subagent runs in its own context window; control returns to the parent session
for follow-up. A skill that needs a pass references the agent by name and dispatches
it the same way — it does **not** inline the agent's checklist.

## Conventions

- **Hard constraints live in the agent body, not in CLAUDE.md/AGENTS.md.**
  Worktree-isolated dispatches do **not** load CLAUDE.md or AGENTS.md, so any
  non-negotiable rule must be restated in the agent file or the repo skill it loads.
- **`tools:` is a least-privilege allowlist** — start strict; expand only on observed need.
- **DESIGN.md (and AGENTS.md) stay the source of truth.** Agents reference them by
  section — they never restate or fork specs into their own body.
- **Design agent reports; bot review posts gated verdicts.** Design-reviewer does not
  approve PRs. `julianken-bot` posts as `@julianken-bot` per the routed skill.

## Adding agents

1. One agent per file: filename = `<name>.md`, matching frontmatter `name`.
2. Required frontmatter: `name`; `description` (trigger-rich, ≥1 `<example>`); `tools`; `model`; `skills` when a repo skill loads.
3. Self-contained body — restate hard constraints for worktree dispatch.
4. **Add a row to the Agents table above.**
5. Point at skills / AGENTS.md sections instead of duplicating process docs.

Once a third agent lands, a `_patterns.md` crosswalk may earn its place — not before.
