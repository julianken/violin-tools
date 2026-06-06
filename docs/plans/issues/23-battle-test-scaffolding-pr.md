## Context & goal

Template prep (bucket A) capstone — [`docs/plans/template-prep.md`](docs/plans/template-prep.md). Before creating a public template repo, prove the scaffolding loop works: branch → five-section PR → `@julianken-bot` review → Mergify queue → green scaffolding CI.

**Goal:** One intentional scaffolding PR that exercises [#15–#22](https://github.com/julianken/violin-tools/issues/15) outputs and surfaces friction in skills/validator.

## Approach

Pick a **small doc-only delta** (e.g. README tweak or validator comment) so the test isolates process, not product code. Follow [`.claude/skills/pr-workflow/SKILL.md`](.claude/skills/pr-workflow/SKILL.md) and repo-local skills from #16. Plan review is not required for this capstone if the change is the test itself — but PR review must be real.

## Concrete plan

1. Ensure #15–#22 deliverables are on `main` (or state which are intentionally deferred with owner sign-off).
2. Open PR with full five-section body; honest N/A test plan from #22.
3. Dispatch fresh-context `@julianken-bot` PR review; cycle to APPROVED on HEAD.
4. Post `@Mergifyio queue`; confirm squash merge.
5. File follow-up issues for any friction found (skills, validator, template wording).

## Acceptance criteria

- [ ] `@julianken-bot` `APPROVED` review on the final PR HEAD (not issue comment — PR review API)
- [ ] `bash scripts/validate-scaffolding.sh` green on `main` after merge
- [ ] Scaffolding CI workflow green on `main`
- [ ] Implementing PR doc-currency checkbox satisfied or N/A justified
- [ ] Friction log: zero issues OR linked follow-up issue numbers in capstone PR Summary

## Depends on

[#15](https://github.com/julianken/violin-tools/issues/15), [#16](https://github.com/julianken/violin-tools/issues/16), [#17](https://github.com/julianken/violin-tools/issues/17), [#18](https://github.com/julianken/violin-tools/issues/18), [#19](https://github.com/julianken/violin-tools/issues/19), [#20](https://github.com/julianken/violin-tools/issues/20), [#21](https://github.com/julianken/violin-tools/issues/21), [#22](https://github.com/julianken/violin-tools/issues/22).

## Blocks

Public template repo creation (bucket B).

## Plan reference

[`docs/plans/issues/23-battle-test-scaffolding-pr.md`](docs/plans/issues/23-battle-test-scaffolding-pr.md)
