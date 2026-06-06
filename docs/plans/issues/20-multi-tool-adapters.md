## Context & goal

Template prep (bucket A) — [`docs/plans/template-prep.md`](docs/plans/template-prep.md). Issue [#10](https://github.com/julianken/violin-tools/issues/10) validated Cursor reads [`AGENTS.md`](AGENTS.md) natively; other harnesses need thin adapters, not duplicated rules.

**Goal:** Add [`GEMINI.md`](GEMINI.md) and [`.github/copilot-instructions.md`](.github/copilot-instructions.md) as **pointers** to `AGENTS.md` — same pattern as [`CLAUDE.md`](CLAUDE.md) shim (import/point, don't fork).

## Approach

One-line or short `@AGENTS.md` / "read AGENTS.md" pointer per adapter. Document in [`GAPS.md`](GAPS.md) that Cursor uses native `AGENTS.md` + [`.cursor/rules/review-dispatch.mdc`](.cursor/rules/review-dispatch.mdc) (partial wake per #24). Do **not** add `.cursor/mcp.json` (GAPS deferred).

## Concrete plan

1. Create `GEMINI.md` — pointer to `AGENTS.md`; note `DESIGN.md` wins on design.
2. Create `.github/copilot-instructions.md` — same pointer for Copilot.
3. Reconcile `GAPS.md` row 23 if adapter set changes.

## Acceptance criteria

- [ ] Both adapter files exist and contain **no duplicated process rules** (spot-check: no full HIL section copy-pasted)
- [ ] Each file explicitly names `AGENTS.md` as SoT
- [ ] `GAPS.md` documents which adapters exist and what remains deferred
- [ ] `scripts/check-claude-shim.sh` passes (no unintended `CLAUDE.md` edit)

## Depends on

[#15](https://github.com/julianken/violin-tools/issues/15) — optional; adapters can land independently but should not reference instance literals that moved to `INSTANCE.md` incorrectly.

## Blocks

[#21](https://github.com/julianken/violin-tools/issues/21) — `validate-scaffolding.sh` may check adapter files exist.

## Plan reference

[`docs/plans/issues/20-multi-tool-adapters.md`](docs/plans/issues/20-multi-tool-adapters.md)
