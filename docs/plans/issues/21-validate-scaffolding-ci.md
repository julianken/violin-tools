## Context & goal

Template prep (bucket A) — [`docs/plans/template-prep.md`](docs/plans/template-prep.md). [`GAPS.md`](GAPS.md) row 18 defers CI-gating [`scripts/check-claude-shim.sh`](scripts/check-claude-shim.sh) until a workflow exists. Scaffolding validation is the first meaningful CI job.

**Goal:** Add [`scripts/validate-scaffolding.sh`](scripts/validate-scaffolding.sh) and [`.github/workflows/scaffolding.yml`](.github/workflows/scaffolding.yml); retire or update the GAPS deferral row when merged.

## Approach

Validator checks committed scaffolding invariants: shim script passes, required paths exist (`AGENTS.md`, `CLAUDE.md`, skills, optional adapters from #20), no placeholder `TODO(template)` in core process files, adapter pointer files not empty. **Not** app lint/test.

## Concrete plan

1. Implement `scripts/validate-scaffolding.sh` with clear pass/fail messages.
2. Add workflow: run validator on PR + push to `main` (path-filter if useful).
3. Reconcile `GAPS.md` — mark CI-shim trigger fired or narrow deferral.

## Acceptance criteria

- [ ] `bash scripts/validate-scaffolding.sh` exits 0 on current `main` after this PR merges
- [ ] GitHub Actions workflow runs and passes on the implementing PR
- [ ] `GAPS.md` row 18 (CI-gate shim) reconciled in same PR
- [ ] Validator does not require `package.json` or app source

## Depends on

[#15](https://github.com/julianken/violin-tools/issues/15) — may check `INSTANCE.md` exists once #15 lands.  
[#20](https://github.com/julianken/violin-tools/issues/20) — adapter file checks if included in validator scope.

## Blocks

[#23](https://github.com/julianken/violin-tools/issues/23) — capstone expects CI green.

## Plan reference

[`docs/plans/issues/21-validate-scaffolding-ci.md`](docs/plans/issues/21-validate-scaffolding-ci.md)
