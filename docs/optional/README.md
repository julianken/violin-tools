# Optional modules

These docs describe the **personal infrastructure** this repo happens to use — they are *optional overlays*, not mandatory core. A template consumer can adopt each one or skip it; the core process in [`AGENTS.md`](../../AGENTS.md) and [`.claude/skills/`](../../.claude/skills/) works without any of them.

Each file is an **adopt-or-skip explainer**, written to match the *current* violin-tools setup (not an aspirational one). None of them is a second source of truth: where a mechanic has a canonical home (the `.mergify.yml` invariants, the bot credential loading, the Figma node map), the optional doc points at that home rather than restating it.

| Module | What it covers | Skip it if… |
| --- | --- | --- |
| [`mergify.md`](./mergify.md) | Merge-queue automation via Mergify (`.mergify.yml`, the `@Mergifyio queue` trigger) | you merge manually or use a different queue |
| [`review-bot.md`](./review-bot.md) | A dedicated machine-user reviewer (`@julianken-bot`) to satisfy a per-HEAD review gate | a human reviewer (or no review gate) is fine for your repo |
| [`figma.md`](./figma.md) | Reading a Figma design system over the read-only MCP | your design source of truth isn't Figma |
| [`user-skills.md`](./user-skills.md) | When per-developer user-level skills overlay the repo-local ones | you only ever use the repo-local `.claude/skills/` |

**Authority:** these docs never override core. On any conflict the canonical source named inside each doc wins (e.g. `.mergify.yml` for the queue config, the user-level `reviewing-as-julianken-bot` skill for bot credential mechanics, `INSTANCE.md` for the Figma node map). When you adopt a module, follow its **Adopt** section; when you skip it, follow its **Skip** section — neither leaves the core process broken.
