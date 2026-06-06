# INSTANCE.md

<!-- INSTANCE FACTS for this specific product/repo: what it is, its GitHub identity,
its Figma design file, and its merge/review infra. AGENTS.md is the source of truth
for PROCESS (how agents work); this file is the source of truth for INSTANCE (which
product, which repo, which Figma file, which merge setup). DESIGN.md remains the
source of truth for design. Keep process rules out of this file — they belong in
AGENTS.md so the process shape stays portable across products. -->

## What this is
Violin Tools — a web app of focused practice tools for violinists. Its first tool is **Scales**, a whole-neck fingerboard note map. Client-side static web app, built largely by AI coding agents through reviewed, squash-merged PRs.

## Repo identity
Local folder `violin-scales/`; GitHub slug `julianken/violin-tools` — they differ, so pass the slug to `gh`. Default branch `main`.

## Design / Figma (read-only)

`DESIGN.md` is the source of truth for design (see AGENTS.md → "Design source of truth" for the authority ranking). The instance facts about *this product's* Figma file live here.

The design system lives in Figma (file `HWmo5hCeSXWtkSBiO1msIF`). Read it via the Figma MCP **read tools only** — `get_metadata`, `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map`, `get_libraries`, `search_design_system`, `whoami`. **Never** call a write tool (`use_figma`, `create_new_file`, `generate_figma_design`, `generate_diagram`, `upload_assets`, `add_code_connect_map`): agents read Figma; a human edits it.

**Authority:** shipped build > `DESIGN.md` > Figma. `DESIGN.md` wins on any design conflict; a live Figma value that disagrees with it does **not** bind the build — it's *drift to reconcile into `DESIGN.md` §0 in a PR*. Never build straight from a live Figma node, and don't paste its raw hexes/Tailwind — translate to `DESIGN.md` tokens. The two do not auto-sync.

**Flow:** for a known node call `get_design_context` directly; for a large/unknown subtree call `get_metadata(<node>)` first to scope, then `get_design_context`; use `get_screenshot` for visual reference. A URL's `?node-id=45-2` is tool `nodeId: 45:2` (hyphen → colon).

**Node map** — URL form `https://figma.com/design/HWmo5hCeSXWtkSBiO1msIF/?node-id=<n-n>`. Pages: Foundations `1-2` · Components `1-3` · Screens `1-4` · States `1-5` · Motion `1-6` · Annotations `1-7` · Colors/Dark specimen `30-4`. Screens: A Major `45-2` · A Harmonic Minor `23-2` · A Chromatic `23-408` · ⌘K Command Palette `25-2`. **MCP quirk:** `get_metadata` with no node-id lists only the Cover, so always pass an explicit node-id from this map. Node-ids are drift-prone (a frame rename/reorder can renumber them) — the Update-Triggers row, not the ids, is the safety net. Live Variable reads and Code Connect are unavailable on the current Figma plan (`get_variable_defs` → `{}`); treat Figma as visual reference, not a token feed.

## Merge / review infra
- **Mergify is in use** (`.mergify.yml`): an approved PR squash-merges through the queue via a standalone `@Mergifyio queue` comment. The merge *method* and its invariants are process — see `.claude/skills/pr-workflow/SKILL.md` and the user-level `mergify-merge-workflow` skill.
- **`@julianken-bot` is the sole non-author reviewer.** Direct push to `main` is blocked by a GitHub ruleset requiring 1 fresh approving review per HEAD from a non-author collaborator; the owner (`@julianken`, the lone code owner in `.github/CODEOWNERS`) authors PRs and can't self-approve, so `@julianken-bot` — the only other collaborator — is what unblocks merge.
