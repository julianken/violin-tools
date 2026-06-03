# CLAUDE.md

## Project

Violin Tools is an early-stage, dark-only web app of practice tools for violinists. v1 ships exactly one tool — **Scales**, a whole-neck fingerboard note map. The design language is fixed in `DESIGN.md`, and that document governs all UI work: where it conflicts with anything else, `DESIGN.md` wins.

## Repo identity

The local folder is `violin-scales/`, but the GitHub slug is **`julianken/violin-tools`** — the names do not match, so always pass the slug to `gh`. Default branch is `main`.

## Files to read first

1. `DESIGN.md` — mandatory before any UI or token work; authoritative on any conflict. Holds the token manifest, color/type/spacing/motion contracts, the fingerboard vocabulary rule, and the accessibility model.
2. `docs/superpowers/specs/2026-06-02-violin-scales-design.md` (untracked — may not exist on a fresh clone; if absent, treat `DESIGN.md` as the sole source of truth until the spec is committed) — implementation-ready detail: the planned file tree, TypeScript data model, routing rules, and music-engine algorithm. Consult when scaffolding app code. Where the spec and `DESIGN.md` disagree on any design value or vocabulary, `DESIGN.md` wins; the spec's authority is limited to file-tree layout, routing, and algorithm detail.

To learn the current state of the tree, run `git status` and `ls` rather than trusting a snapshot in this file. No `package.json` or app code is committed yet, so the build/test tooling below does not exist until the app is scaffolded.

## Planned stack (forward-looking — not yet scaffolded)

The spec file (item 2 above, if present on disk) holds the authoritative file tree. Until app code lands, this is the intended target and may change.

- **Language:** TypeScript, strict mode.
- **Framework:** Next.js (App Router) — confirm against the spec before scaffolding.
- **Styling:** Tailwind CSS v4 + CSS custom properties for the `DESIGN.md` tokens.
- **Rendering:** inline SVG for the note map (required for per-marker ARIA), not Canvas.
- **Audio:** Web Audio API for playback.
- **Package manager:** **npm**. Do not introduce an alternative package manager.

## Build / test / run (when code lands)

Once the app is scaffolded, these are the scripts (names match the PR template):

```
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # type check, no emit
npm run test       # unit tests
```

UI changes also require a Playwright MCP smoke drive before a PR is merge-ready: drive the feature via `mcp__plugin_playwright_playwright__browser_*` at both viewports with a console-clean assertion. `.github/PULL_REQUEST_TEMPLATE.md` spells out the exact viewport sizes and the console-clean check — read it for the precise gate.

## Coding conventions (forward-looking)

- TypeScript strict mode; no `any`.
- The music engine (scale + fingerboard computation) stays pure: no side effects, no I/O. It is the part that most needs unit tests — add them with the first engine code.
- URL is the single source of truth for app state; no global store.
- For formatting and linting, document the chosen toolchain in this section once a decision is made.

## Commit conventions

Conventional Commits. No trailer is configured in git, so append it by hand on every commit body, matching the active session model name. The repo's existing history uses:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

Substitute the active model name if it differs (e.g. `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`). The model ID is available from the session context / system reminder.

## PR & review process

The PR body follows `.github/PULL_REQUEST_TEMPLATE.md` — read it rather than relying on a summary; it mandates a diagram-first body, the screenshot rules, and the full test-plan checklist (including the Playwright MCP smoke gate above). Two facts that live here, not in the template:

- **Screenshots** go through the `pr-screenshots-via-user-attachments` skill (`user-attachments/assets/<uuid>` URLs). Never commit screenshot files to the repo.
- **Code review** is dispatched as the `reviewing-as-julianken-bot` subagent, never via `gh pr review` from the main session. Design-surface changes also get a `ui-design:design-system-architect` or `ui-designer` review subagent.

## Self-containment rule

Do not reference any other instrument, music app, website, or external inspiration anywhere in the repo — code, comments, copy, or PRs.

The violin fingerboard is smooth and unmarked: it has no fixed pitch divisions. Use `fingerboard`, `neck`, `position`, `semitone column`; never use terms that imply fixed pitch divisions. This is the **continuous-pitch rule** (`DESIGN.md` §0/§1) — a correctness constraint, not a style preference. Violating it in copy or code is a design-review finding.
