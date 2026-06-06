# Template prep (bucket A) — violin-tools

**Status:** in progress · **Goal:** make `julianken/violin-tools` self-contained enough to templatize later without grep-and-hope.

**Not in bucket A:** creating the public template repo, empty SPEC/DESIGN stubs, `package.json`, app CI, placeholder substitution scripts (bucket B — after templatization).

This file is a **portable program overview**: scope and dependencies expressed with local plan IDs, not host-specific tracker links. The tracker (GitHub issues, Linear, etc.) is an implementation detail and can vary by repo.

## Dependency graph

```mermaid
flowchart TD
  T1["T1 · INSTANCE split"]
  T8["T8 · PR template honest N/A"]
  T2["T2 · repo-local skills"]
  T3["T3 · bootstrap + START_HERE"]
  T4["T4 · Status + anti-invention"]
  T5["T5 · docs/optional/"]
  T6["T6 · multi-tool adapters"]
  T7["T7 · validate-scaffolding + CI"]
  T9["T9 · battle-test scaffolding PR"]

  T1 --> T2
  T1 --> T3
  T1 --> T4
  T1 --> T5
  T1 --> T6
  T2 --> T5
  T6 --> T7
  T1 --> T7
  T2 --> T9
  T3 --> T9
  T4 --> T9
  T5 --> T9
  T6 --> T9
  T7 --> T9
  T8 --> T9
```

## Work items

| Plan ID | Deliverable |
| --- | --- |
| T1 | Split `INSTANCE.md` from `AGENTS.md` |
| T2 | Add repo-local `creating-prs` and `reviewing` skills |
| T3 | Add `project-bootstrap` (validate mode) + `START_HERE.md` |
| T4 | Add lifecycle status + anti-invention rules |
| T5 | Move personal infra guidance to `docs/optional/` |
| T6 | Add multi-tool adapters (`GEMINI.md`, Copilot instructions) |
| T7 | Add `validate-scaffolding.sh` + scaffolding CI |
| T8 | Mark PR template test/build lines as not configured |
| T9 | Battle-test full scaffolding PR flow |

## Tracker mapping

If a repo uses an external tracker, map tracker IDs to `T1`-`T9` in that tracker. Keep this file free of tracker-specific links so it can be copied without rewriting.

## Issue quality bar

Implementation issue/spec authoring should follow `.claude/skills/issue-authoring/SKILL.md`, and each spec should be gated by `.claude/skills/issue-plan-review/SKILL.md` before implementation starts.

**Never cite** paths that are not on `main` (no local-only working folders).
