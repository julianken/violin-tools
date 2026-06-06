## Context & goal

Template prep (bucket A) — [`docs/plans/template-prep.md`](docs/plans/template-prep.md). [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) lists `npm run typecheck`, `npm run test`, `npm run build`, and Playwright smoke — **none exist** in this pre-code repo. Agents check boxes falsely or waste review cycles.

**Goal:** Mark test/build commands as **`not configured`** (or `N/A — pre-code`) while preserving the five-section shape and doc-currency checkbox.

## Approach

Honest template > aspirational template. Keep the violin example mermaid in the template (product-specific instance artifact) until a separate design chooses otherwise. Do not add `package.json` in this issue.

## Concrete plan

1. Edit PR template test-plan lines to state commands are not configured until stack lands.
2. Preserve Screenshots section rules and doc-currency checkbox verbatim.
3. Note in implementing PR Summary: `No doc updates needed` beyond template if nothing else touched.

## Acceptance criteria

- [ ] No template line implies `npm run *` commands exist today without `not configured` / `N/A` qualifier
- [ ] Five section headers unchanged
- [ ] Doc-currency checkbox text unchanged
- [ ] Example mermaid may remain (instance-specific) — document in PR Summary if kept intentionally

## Depends on

None — can parallel [#15](https://github.com/julianken/violin-tools/issues/15).

## Blocks

[#23](https://github.com/julianken/violin-tools/issues/23) — battle-test uses the template.

## Plan reference

[`docs/plans/issues/22-pr-template-honest-na.md`](docs/plans/issues/22-pr-template-honest-na.md)
