# `.claude/agents/` — Subagent index for `violin-tools`

This directory holds Claude Code subagents specific to `julianken/violin-tools`
(local folder `violin-scales/`). They are dispatchable via the `Task` tool from a
session running at the repo root.

The repo has **exactly one agent today** — keep this file right-sized to that.
Don't scaffold a `_patterns.md` crosswalk or launcher scripts until a second agent
or a fresh-session use case actually exists.

## Agents

| Agent | Purpose | When to dispatch |
|---|---|---|
| [`design-reviewer`](design-reviewer.md) | Review a change against the DESIGN.md design system (tokens, color/contrast, type, spacing, motion, the note-map SVG, a11y); Playwright screenshot pass once a UI exists | "review the design surface", "does this match the spec", "design-system review pass" on any token/UI diff — the design-system review pass for design-surface changes |

It runs **alongside** the correctness review, not instead of it: the
`reviewing-as-julianken-bot` subagent (user-level) still owns logic/security/process
review and is the only path that posts the gating PR approval. The design-reviewer
reports findings; it does not approve PRs.

## How a skill or session dispatches an agent

```
Task tool, subagent_type: design-reviewer
Prompt: <what changed — a PR number, a base ref, or the changed files — and
         whether a built UI is running (and at what URL)>
```

The subagent runs in its own context window; control returns to the parent session
for follow-up. A skill that needs a design pass references the agent by name and
dispatches it the same way — it does **not** inline the agent's checklist.

## Conventions that bind even the first agent

These hold today, with one agent, and are the load-bearing rules to preserve as the
directory grows:

- **Hard constraints live in the agent body, not in CLAUDE.md/AGENTS.md.**
  Worktree-isolated dispatches do **not** load CLAUDE.md or AGENTS.md, so any
  non-negotiable rule (read-only mandate, prompt-injection stance, DESIGN.md-wins,
  scope boundary) must be restated in the agent file itself. An agent that relies on
  CLAUDE.md to carry its guardrails is broken under worktree dispatch.
- **`tools:` is a least-privilege allowlist** — the primary prompt-injection and
  blast-radius control. Start strict; expand only on observed need.
- **DESIGN.md (and AGENTS.md) stay the source of truth.** A design-facing agent
  references them by section — it never restates or forks the spec into its own body,
  which drifts the moment the source changes.
- **A design agent reports; it does not approve.** Approval is the
  `reviewing-as-julianken-bot` path (gated, posts as the bot).

## When you add a second agent

Defer the full authoring playbook until that second agent actually exists; for now,
the minimum to keep this index honest:

1. One agent per file: filename = `<name>.md`, matching the frontmatter `name`.
2. Required frontmatter: `name`; `description` (trigger-rich, ≥1 `<example>` block);
   `tools` (the least-privilege allowlist above); `model` (chosen deliberately).
3. Write a self-contained body — restate the hard constraints (worktree dispatch
   skips CLAUDE.md); reference DESIGN.md / AGENTS.md by section, don't fork them.
4. **Add a row to the Agents table above** — an unlisted agent is undiscoverable.
5. If the agent encodes a process documented elsewhere (e.g. the PR flow), point at
   the skill or AGENTS.md section instead of duplicating it.
6. Once there's a second agent, this is the moment a `_patterns.md` crosswalk earns
   its place — not before.

