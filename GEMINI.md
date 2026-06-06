<!-- DO NOT ADD UNIVERSAL/PROJECT GUIDANCE HERE. The source of truth is AGENTS.md.
This file is a thin Gemini adapter: it points Gemini at AGENTS.md (process) and
DESIGN.md (design), the same import-don't-fork pattern as the CLAUDE.md shim. Do
not copy process rules (HIL, review dispatch, guardrails) into this file — they
live in AGENTS.md; forking them is drift. Keep this file tiny. -->

# GEMINI.md

@AGENTS.md

**Source of truth:** `AGENTS.md` holds all project/process/agent rules; read it
in full (imported above). `DESIGN.md` is the design source of truth and **wins on
any design conflict** — read it before any UI, token, or motion work. `INSTANCE.md`
holds the instance facts (product identity, GitHub slug, Figma file/node map,
merge/review infra). Do not duplicate any of those rules here.
