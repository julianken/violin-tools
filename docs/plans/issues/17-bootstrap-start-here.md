## Context & goal

Template prep (bucket A) — [`docs/plans/template-prep.md`](docs/plans/template-prep.md). Templatization needs an extractable **bootstrap workflow**: how a new agent session orients in a repo (filled instance today; empty template later).

**Goal:** Add [`START_HERE.md`](START_HERE.md) and [`.claude/skills/project-bootstrap/SKILL.md`](.claude/skills/project-bootstrap/SKILL.md) in **validate mode** — audit the current violin instance against `INSTANCE.md` + `DESIGN.md`; do **not** wipe domain content or run fill-mode placeholder substitution (bucket B).

## Approach

`START_HERE.md` is the human/agent entry card (short). The bootstrap skill is the checklist agents invoke. Both reference [`INSTANCE.md`](INSTANCE.md) (from #15) for repo identity and instance config. **Validate mode** only: confirm files exist, pointers resolve, no contradictions with `DESIGN.md`.

## Concrete plan

1. **`START_HERE.md`** — ordered read list: `INSTANCE.md` → `AGENTS.md` → `DESIGN.md` → skills index; state "filled instance, validate-only bootstrap."
2. **`.claude/skills/project-bootstrap/SKILL.md`** — modes table (validate vs fill); validate checklist (paths exist, Update Triggers honored, no invented stack commands).
3. Link from `START_HERE.md` only (avoid duplicating bootstrap prose in `AGENTS.md` unless one pointer line is needed).

## Acceptance criteria

- [ ] `START_HERE.md` explicitly distinguishes **filled instance** (this repo) vs **future empty template**
- [ ] `START_HERE.md` routes readers to `INSTANCE.md` for repo identity and instance-specific config
- [ ] Bootstrap skill documents **validate** vs **fill** modes; validate is the only mode implemented
- [ ] Dry-run validate checklist against current tree reports no contradictions with [`DESIGN.md`](DESIGN.md) section references cited in the skill
- [ ] No empty `SPEC.md` stub or init CLI (bucket B)

## Depends on

[#15](https://github.com/julianken/violin-tools/issues/15) — `INSTANCE.md` must exist for routing.

## Blocks

Templatization (bucket B) — bootstrap skill is a core extract artifact.

## Plan reference

[`docs/plans/issues/17-bootstrap-start-here.md`](docs/plans/issues/17-bootstrap-start-here.md)
