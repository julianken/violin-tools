# CLAUDE.md

<!-- DO NOT ADD UNIVERSAL/PROJECT GUIDANCE HERE. The source of truth is AGENTS.md.
This file is a hand-maintained Claude-only shim: the line below imports AGENTS.md
in full, then a single "## Claude Code only" tail holds Claude-product mechanics.
Do NOT run /init or revise-claude-md against this file blindly — they re-fold
AGENTS.md content back in and can drop the import line. Keep this file tiny; the
shape is enforced by scripts/check-claude-shim.sh (run in the review pass). -->

@AGENTS.md

## Claude Code only

Applies only to Claude Code; other tools should ignore this section. These are Claude-product mechanics, not new rules — the binding rules (review integrity, agent guardrails, sensitivity) live in AGENTS.md.

- **Review:** Claude Code performs reviews by dispatching the `reviewing-as-julianken-bot` subagent — never `gh pr review` from the main session. For design-surface changes, also dispatch the design-system review pass (`.claude/agents/design-reviewer.md`) before approving.
- **Screenshots:** use the `pr-screenshots-via-user-attachments` skill — never commit image files.
- **Commit trailer:** append `Co-Authored-By:` matching the active session model by hand (the universal commit convention is in AGENTS.md).
- **Shim integrity:** any PR touching CLAUDE.md or AGENTS.md must pass `scripts/check-claude-shim.sh` (not a symlink, import line intact, no leaked sections, stays tiny).
