## Context & goal

Template prep (bucket A) — [`docs/plans/template-prep.md`](docs/plans/template-prep.md). Agents inventing `npm run test`, CI jobs, or stack details that do not exist is a recurring failure mode (see pre-code PR template checkboxes).

**Goal:** Make lifecycle **Status** and **anti-invention** rules explicit in [`AGENTS.md`](AGENTS.md) (or `INSTANCE.md` if status is instance-specific — pick one SoT and document the choice).

## Approach

Pre-code repo: Status is `design` (or equivalent). Anti-invention rules: scan the tree before claiming commands; use `TBD` / `not configured`; never fabricate `package.json` scripts. Align wording with [`README.md`](README.md) if it claims setup steps.

May ship in the **same PR as #15** if that reduces churn.

## Concrete plan

1. Add **Status** field (likely `Status: design — pre-code; no package.json or CI app checks yet`) in the chosen SoT file.
2. Expand anti-invention bullets under Agent guardrails or a dedicated subsection: no invented build/CI/stack; verify with `ls` / `Read` before citing commands.
3. Reconcile [`README.md`](README.md) if it implies commands exist.

## Acceptance criteria

- [ ] Status field is present and accurate for the current pre-code phase
- [ ] Anti-invention rules are explicit and bind all tools (same spirit as "whatever the tool" in guardrails)
- [ ] README does not contradict Status (or README updated in same PR)
- [ ] `scripts/check-claude-shim.sh` passes if `AGENTS.md` touched

## Depends on

[#15](https://github.com/julianken/violin-tools/issues/15) — may land in same PR.

## Blocks

None directly — improves all subsequent prep issues.

## Plan reference

[`docs/plans/issues/18-status-anti-invention.md`](docs/plans/issues/18-status-anti-invention.md)
