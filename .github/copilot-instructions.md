<!-- DO NOT ADD UNIVERSAL/PROJECT GUIDANCE HERE. The source of truth is AGENTS.md.
This file is a thin GitHub Copilot adapter: it points Copilot at AGENTS.md
(process) and DESIGN.md (design), the same import-don't-fork pattern as the
CLAUDE.md shim. Copilot has no @import mechanism, so this is a prose pointer
rather than an import line. Do not copy process rules (HIL, review dispatch,
guardrails) here — they live in AGENTS.md; forking them is drift. Keep it tiny. -->

# Copilot instructions

**Read [`AGENTS.md`](../AGENTS.md) first — it is the source of truth** for all
project/process/agent rules. This file is only a pointer; do not duplicate those
rules here.

- **Design:** [`DESIGN.md`](../DESIGN.md) is the design source of truth and **wins
  on any design conflict** — read it before any UI, token, or motion work.
- **Instance facts:** [`INSTANCE.md`](../INSTANCE.md) holds the product identity,
  GitHub slug, Figma file/node map, and merge/review infra.
