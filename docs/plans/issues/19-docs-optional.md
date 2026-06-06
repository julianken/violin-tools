## Context & goal

Template prep (bucket A) — [`docs/plans/template-prep.md`](docs/plans/template-prep.md). Personal infra (Mergify, `@julianken-bot`, Figma MCP, user-level skills) should be **optional modules**, not mandatory core for template consumers.

**Goal:** Move long instance/optional prose out of core [`AGENTS.md`](AGENTS.md) into [`docs/optional/`](docs/optional/) with short links from process docs.

## Approach

Four optional docs — each self-contained, matching **current** violin-tools setup (not aspirational). Core `AGENTS.md` / `pr-workflow` link instead of inlining. Do **not** remove [`.mergify.yml`](.mergify.yml) or bot collaborator; optional docs explain how to adopt or skip.

## Concrete plan

1. `docs/optional/mergify.md` — queue trigger, `.mergify.yml` invariants, bootstrap caveat.
2. `docs/optional/review-bot.md` — `@julianken-bot`, Keychain PAT, REST review API, separation from main session.
3. `docs/optional/figma.md` — read-only MCP, node map (or pointer to `INSTANCE.md` post-#15), Pro-plan limits.
4. `docs/optional/user-skills.md` — when user-level skills overlay repo-local skills.
5. Trim inlined prose from `AGENTS.md` / `pr-workflow` where optional docs now cover it; Update Triggers if needed.

## Acceptance criteria

- [ ] All four optional docs exist and match current repo behavior
- [ ] Core `AGENTS.md` has no long Mergify walkthrough or full Figma node map (links to optional or `INSTANCE.md` instead)
- [ ] `pr-workflow` links to optional docs for bot credentials path
- [ ] `.mergify.yml` and bot collaborator unchanged
- [ ] Update Triggers reconciled if optional-doc paths added

## Depends on

[#15](https://github.com/julianken/violin-tools/issues/15) — Figma/instance content location.  
[#16](https://github.com/julianken/violin-tools/issues/16) — `reviewing` skill + optional bot doc alignment.

## Blocks

None — enables cleaner template core.

## Plan reference

[`docs/plans/issues/19-docs-optional.md`](docs/plans/issues/19-docs-optional.md)
