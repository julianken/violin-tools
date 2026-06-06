## Context & goal

Template prep (bucket A) — [`docs/plans/template-prep.md`](docs/plans/template-prep.md). After [#15](https://github.com/julianken/violin-tools/issues/15), core process docs should not **require** Julian's user-level `~/.claude/skills/` to describe PR open/review method.

Today [`.claude/skills/pr-workflow/SKILL.md`](.claude/skills/pr-workflow/SKILL.md) restates violin-tools merge mechanics **and** points at user-level `creating-prs`, `reviewing-as-julianken-bot`, etc. A cold-start agent (Cursor, worktree subagent, template consumer) may not have those skills installed.

**Goal:** Repo-local `creating-prs` and `reviewing` skills hold the **generic method**; `pr-workflow` holds **instance facts only** (ruleset, Mergify slug, doc-currency).

## Approach

Copy **method** from user-level skills, strip **credentials and Julian-specific bot mechanics** into [`docs/optional/review-bot.md`](docs/optional/review-bot.md) (landed in #19 — may stub a one-line pointer in this PR if #19 is not done yet). Generic `reviewing` skill = anti-slop rubric usable by human or any bot identity; bot Keychain path stays optional overlay.

Do **not** remove the existing bot dispatch path — document it, don't delete it.

## Concrete plan

1. Add [`.claude/skills/creating-prs/SKILL.md`](.claude/skills/creating-prs/SKILL.md) — five-section PR body discipline, conventional commits, plan reference; no Keychain/bot content.
2. Add [`.claude/skills/reviewing/SKILL.md`](.claude/skills/reviewing/SKILL.md) — anti-slop rubric (≤3 findings, verify-before-claim, severity tiers); bot-agnostic.
3. Refactor [`.claude/skills/pr-workflow/SKILL.md`](.claude/skills/pr-workflow/SKILL.md) — keep ruleset, `@Mergifyio queue`, doc-currency; link to repo-local skills for method; link to optional doc for `@julianken-bot` credentials.
4. Update [`AGENTS.md`](AGENTS.md) Skill ownership: repo-local skills canonical for method; user-level optional overlay.

## Acceptance criteria

- [ ] An agent reading only `.claude/skills/` can describe the five-section PR template without opening `~/.claude/skills/`
- [ ] An agent reading only `.claude/skills/reviewing/SKILL.md` can apply the core anti-slop rules without user-level skills
- [ ] `pr-workflow` does not **require** user-level skill paths in its core flow (optional overlay links OK)
- [ ] `AGENTS.md` Skill ownership section updated in the same PR
- [ ] `scripts/check-claude-shim.sh` passes if `AGENTS.md` touched

## Depends on

[#15](https://github.com/julianken/violin-tools/issues/15) — `INSTANCE.md` split (cleaner skill ownership text).

## Blocks

[#23](https://github.com/julianken/violin-tools/issues/23) — battle-test PR assumes repo-local skills exist.

## Plan reference

[`docs/plans/issues/16-repo-local-skills.md`](docs/plans/issues/16-repo-local-skills.md)
