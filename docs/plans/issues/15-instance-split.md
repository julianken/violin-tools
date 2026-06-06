## Context & goal

Part of **template prep (bucket A)** — see [`docs/plans/template-prep.md`](docs/plans/template-prep.md). Before templatizing `julianken/violin-tools`, **process rules** (how agents work) must separate from **instance facts** (this violin product, this GitHub slug, this Figma file).

Today [`AGENTS.md`](AGENTS.md) mixes both: lines 5–9 (product + repo identity), lines 11–21 (Figma node map), plus universal process (Update Triggers, HIL, review dispatch, skill ownership). Templatization should copy the process shape without manual grep for violin literals.

**Goal:** Introduce [`INSTANCE.md`](INSTANCE.md) as the instance SoT; slim `AGENTS.md` to process-only with a single pointer to instance config.

## Approach

Follow the repo's **single-source-of-truth / no-drift** discipline — do not create a parallel config tree. Move instance prose verbatim where possible; add one Update Triggers row for `INSTANCE.md`. Cross-references in [`CLAUDE.md`](CLAUDE.md), [`.claude/skills/pr-workflow/SKILL.md`](.claude/skills/pr-workflow/SKILL.md), and [`.claude/agents/README.md`](.claude/agents/README.md) point at `INSTANCE.md` instead of duplicating facts.

**Right-sized:** one PR; no `package.json`, no DESIGN.md stub, no removal of [`.mergify.yml`](.mergify.yml) or bot collaborator (those stay instance/optional).

## Concrete plan

1. **Create `INSTANCE.md`** with sections moved from `AGENTS.md`:
   - Product one-liner ("What this is")
   - Repo identity (local folder `violin-scales/` vs GitHub slug `julianken/violin-tools`)
   - Design/Figma instance block (file ID, node map, read-only MCP rule summary — link to `DESIGN.md` for design authority)
   - Instance infra facts: Mergify in use, `@julianken-bot` as sole non-author reviewer (reference [`.mergify.yml`](.mergify.yml), [`.github/CODEOWNERS`](.github/CODEOWNERS))
2. **Slim `AGENTS.md`** — remove moved sections; add early pointer: *instance facts live in `INSTANCE.md`*.
3. **Update Triggers** — new row: instance/config/Figma map/slug changes → reconcile `INSTANCE.md`.
4. **Cross-refs** — `pr-workflow`, agents README, and any other files that quoted instance literals from `AGENTS.md`.
5. Run [`scripts/check-claude-shim.sh`](scripts/check-claude-shim.sh) if `CLAUDE.md`/`AGENTS.md` touched.

## Acceptance criteria

- [ ] `AGENTS.md` contains **no** violin product description, Figma file IDs, or `julianken/violin-tools` slug literals
- [ ] `INSTANCE.md` exists and preserves the same factual content that was removed from `AGENTS.md`
- [ ] Update Triggers table includes an `INSTANCE.md` row
- [ ] `pr-workflow` and `.claude/agents/README.md` reference `INSTANCE.md` where they previously relied on `AGENTS.md` for slug/product/Figma
- [ ] `scripts/check-claude-shim.sh` passes
- [ ] Implementing PR Summary states doc updates or `No doc updates needed`

## Depends on

None — first in template-prep sequence.

## Blocks

- [#16](https://github.com/julianken/violin-tools/issues/16) — repo-local skills (cleaner `AGENTS.md` extraction)
- [#17](https://github.com/julianken/violin-tools/issues/17) — START_HERE routes to `INSTANCE.md`
- [#19](https://github.com/julianken/violin-tools/issues/19) — optional docs (Figma map moves out of core `AGENTS.md`)

## Plan reference

[`docs/plans/template-prep.md`](docs/plans/template-prep.md) · Issue spec: [`docs/plans/issues/15-instance-split.md`](docs/plans/issues/15-instance-split.md)
