---
name: project-bootstrap
description: Use when a fresh agent or human session needs to orient in this repo before doing work — confirm the instance is coherent (paths exist, pointers resolve, no contradictions with DESIGN.md). Triggers on "bootstrap", "orient in this repo", "where do I start", "validate the instance", "is this repo coherent", "get my bearings". Self-contained for worktree dispatch. Validate mode only; fill mode is documented but not implemented.
---

# Project bootstrap (julianken/violin-tools)

**Announce at start:** *"I'm using the project-bootstrap skill to orient in this repo (validate mode)."*

The orientation checklist a session runs to confirm this repo is coherent before working in it. The human/agent entry card is [`START_HERE.md`](../../../START_HERE.md); this skill is the checklist it points to. Read [`INSTANCE.md`](../../../INSTANCE.md) for instance facts (product, `gh` slug, Figma file, merge/review infra) and [`AGENTS.md`](../../../AGENTS.md) for process; this skill does not restate either.

## Modes

This repo is a **filled instance** that is *also* the seed for a future **empty template** (bucket B in [`docs/plans/template-prep.md`](../../../docs/plans/template-prep.md)). Bootstrapping runs in one of two modes:

| Mode | When | What it does | Status |
| --- | --- | --- | --- |
| **validate** | Filled instance (this repo, today) | Audit that the instance is coherent — files exist, pointers resolve, no contradictions with `DESIGN.md`. **Never** wipes or rewrites domain content. | **Implemented (this skill).** |
| **fill** | Future empty template | Substitute placeholders (product name, slug, Figma id, design tokens) to stand up a new product from the stripped scaffold. | **Not implemented** — documented here so the mode boundary is explicit; landing it is bucket B, gated by templatization (`docs/plans/template-prep.md`). Do **not** run placeholder substitution in this repo. |

In this repo you always run **validate**. Fill mode does not exist yet; do not invent it.

## Validate checklist

Run top-to-bottom against the **live tree** (`git status` / `ls` — don't trust a snapshot). Each item is mechanically checkable; if any fails, the instance is not coherent — report it, don't silently proceed.

1. **Entry + orientation files exist.** `START_HERE.md`, `INSTANCE.md`, `AGENTS.md`, `DESIGN.md`, `CLAUDE.md`, and this skill are all present at their cited paths.
2. **Cross-pointers resolve.** Every path `START_HERE.md` links (`INSTANCE.md`, `AGENTS.md`, `DESIGN.md`, `.claude/skills/`) and every path this skill links resolves to a real file/dir. No dead link.
3. **Instance facts present in `INSTANCE.md`.** It names the product, the local-folder-vs-`gh`-slug identity, the Figma file id + node map, and the Mergify/review infra. (It is the catalogue of instance facts; `AGENTS.md` stays process-only.)
4. **Update Triggers honored.** `AGENTS.md` carries the "Keeping docs and drift-prone files current" table; if your change touches anything it lists, you update the matching doc in the same PR (the table is the source of truth for which file maps to which change).
5. **No invented stack commands.** This is a pre-code repo — there is no `package.json`, build, or test command. Do **not** cite or run `npm`/build/test commands the repo doesn't have; `README.md` and `AGENTS.md` say build/run commands get added *when they exist*, not ahead of time.
6. **No contradictions with `DESIGN.md`.** `DESIGN.md` wins on any design conflict (`AGENTS.md` → "Design source of truth"). Confirm the `DESIGN.md` `§` anchors this checklist relies on actually resolve — they are real top-level sections, so a reference to them is well-founded, not a phantom anchor. **These anchors must resolve (lower bound):**
   - **§0 Token Manifest** — where a live Figma value that disagrees gets reconciled as drift.
   - **§7 Motion** — the motion source of truth any motion/transition work must match.
   - **§12 The Fingerboard Note Map** (incl. the §12.5 pitch-classification model) — the signature component and its pitch model.

   If any listed `§` anchor does not resolve in `DESIGN.md` (e.g. a renumber moved it), that is a contradiction to report and reconcile — update either `DESIGN.md` or this list in the same PR, per the Update Triggers table.

A pass means: all six items hold and the cited `§` anchors resolve. Report a one-line pass/fail per item; on any fail, name the file and what's wrong.

## Scope

- **Validate only.** This skill audits; it does not mutate domain content, and it does not run fill-mode substitution. There is no empty `SPEC.md` stub and no init CLI — those are bucket B (`docs/plans/template-prep.md`).
- **Don't duplicate.** This skill does not restate `INSTANCE.md`, `AGENTS.md`, or `DESIGN.md` content — it points to them. `START_HERE.md` is the only entry that links here; `AGENTS.md` is not expanded with bootstrap prose.

## Program doc

[`docs/plans/template-prep.md`](../../../docs/plans/template-prep.md) — this skill is **T3** (bootstrap + `START_HERE.md`); fill mode and the empty template are bucket B.
