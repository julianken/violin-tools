# START HERE

Entry card for a fresh agent or human session. Read this first, then follow the ordered list below to orient before doing any work.

## This is a filled instance — not an empty template

This repo (`julianken/violin-tools`) is a **filled instance**: it already carries its real domain content — the violin product, the `DESIGN.md` design system, the live process docs. It is *also* the seed for a future **empty template** (a reusable scaffold with the violin specifics stripped out — bucket B in [`docs/plans/template-prep.md`](docs/plans/template-prep.md), not built yet).

The two states differ in what `INSTANCE.md`, `DESIGN.md`, and the domain docs contain — **not** in the process shape, which is identical and lives in `AGENTS.md`. When you bootstrap, you bootstrap in one of two modes:

- **validate** (today, this repo): audit that the existing instance is coherent — files exist, pointers resolve, no contradictions with `DESIGN.md`. **Do not** wipe or rewrite domain content.
- **fill** (future, empty template): substitute placeholders to stand up a new product. **Not implemented** — see the bootstrap skill.

If you are in this repo, you are in **validate** mode. Don't run fill-mode substitution here.

## Ordered read list

Read these in order; each says what it is the source of truth for.

1. **[`INSTANCE.md`](INSTANCE.md)** — *instance facts*: which product, the local-folder-vs-`gh`-slug identity (`violin-scales/` ↔ `julianken/violin-tools`), the Figma file ID + node map, and the Mergify/review infra. Go here first for "what repo is this and how does it ship."
2. **[`AGENTS.md`](AGENTS.md)** — *process* (portable across products): conventions, review dispatch, the Update Triggers table for keeping docs current, agent guardrails, the HIL/`AGENT:` comment rules.
3. **[`DESIGN.md`](DESIGN.md)** — *design source of truth*; **wins on any design conflict**. Token manifest (§0), color, type, motion, components, accessibility, and the fingerboard note-map model (§12.5). Read before any UI, token, or motion work.
4. **Skills index** — [`.claude/skills/`](.claude/skills/): `project-bootstrap` (orient/validate this instance), `pr-workflow` (instance facts + routing for open/review/merge), `creating-prs` (the five-section PR-body method) + `reviewing` (the bot-agnostic anti-slop review rubric), `issue-authoring` + `issue-plan-review` (spec a change, gate it before coding).

`CLAUDE.md` is a thin Claude-Code shim that imports `AGENTS.md`; read `AGENTS.md` for the binding rules.

## Bootstrap

To run the orientation checklist, use **[`.claude/skills/project-bootstrap/SKILL.md`](.claude/skills/project-bootstrap/SKILL.md)** — it documents validate vs fill modes and the validate checklist (paths exist, Update Triggers honored, no invented stack commands, no `DESIGN.md` contradictions).
