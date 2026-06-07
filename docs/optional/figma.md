# Optional module — Figma design system (scoped-write MCP)

**Optional.** This repo's design system lives in a Figma file, accessed by agents over the Figma MCP. A template consumer whose design source of truth isn't Figma can skip this entirely — the design source of truth is [`DESIGN.md`](../../DESIGN.md), which **wins on any design conflict** regardless of whether Figma is in the picture.

This doc is the *adopt-or-skip* narrative. It is **not** the source of truth for *this product's* Figma file ID, node map, or the exact write policy: those are instance facts in [`INSTANCE.md`](../../INSTANCE.md) → "Design / Figma (scoped writes)". Don't restate the file key or node-ids here — point at `INSTANCE.md`, which is where they're maintained (and which the Update Triggers table keeps current when frames are renamed or reordered).

## How Figma is used here

- **Read freely; write only on a feature/WIP page (scoped writes, since 2026-06-07).** Agents read via the MCP read tools (`get_metadata`, `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map`, `get_libraries`, `search_design_system`, `whoami`). Agents **may** call write tools (`use_figma`, `create_new_file`, `upload_assets`) **only on a designated per-feature/WIP page** (one page per feature, e.g. `Scales — Note Map`). The shared **system pages stay human-edited** — Foundations, Components, States, Motion, Annotations, and the existing Screens boards. `generate_figma_design` (capture a web page into Figma) and `generate_diagram` (Mermaid → FigJam) are write tools too — same scoped-page rule; `add_code_connect_map` / Code Connect stay **out of scope**. Load the `/figma-use` skill before any `use_figma` call and build idempotently (name-/`setSharedPluginData`-keyed). The canonical, binding statement of this policy is `INSTANCE.md`; this is the explainer.
- **Authority ranking: shipped build > `DESIGN.md` > Figma.** Unchanged by the scoped-write flip. A live Figma value that disagrees with `DESIGN.md` does **not** bind the build — it's *drift to reconcile into `DESIGN.md` §0 in a PR*. Values flow **`DESIGN.md` §0 → Figma, never the reverse**: never build straight from a live Figma node, and never paste its raw hexes/Tailwind. The two do not auto-sync.
- **Flow:** for a known node call `get_design_context` directly; for a large/unknown subtree call `get_metadata(<node>)` first to scope, then `get_design_context`; use `get_screenshot` for visual reference. A URL's `?node-id=45-2` is tool `nodeId: 45:2` (hyphen → colon).

The file ID, the page/screen node map, the scoped-write page boundary, and the MCP quirks specific to *this* file are catalogued in [`INSTANCE.md`](../../INSTANCE.md).

## Plan limits (this file, today)

On the current Figma plan, **live Variable reads and Code Connect are unavailable** (`get_variable_defs` returns `{}`). Treat Figma as **visual reference, not a token feed** — the tokens come from `DESIGN.md`, not an MCP variable read, and a scoped write must never author a parallel token system in Figma that could drift against `DESIGN.md` §0. The `get_metadata`-with-no-node-id quirk (it lists only the Cover) means you always pass an explicit node-id from the `INSTANCE.md` node map.

## Adopt

1. Record your Figma file ID and node map in `INSTANCE.md` → "Design / Figma (scoped writes)" (the instance source of truth — not in this doc).
2. Connect the Figma MCP and confirm the tools resolve (`whoami`, then `get_metadata` against a known node-id).
3. Keep the **scoped-write boundary** (writes only on a feature/WIP page; system pages human-edited) and the `build > DESIGN.md > Figma` authority ranking with one-way `DESIGN.md §0 → Figma` value flow — they're what keep Figma from silently overriding the shipped design.
4. Add the node-map-drift row to the Update Triggers table so node-ids stay current (this repo already has it).

## Skip

If your design source of truth isn't Figma, remove the "Design / Figma" section from `INSTANCE.md` and don't connect the Figma MCP. `DESIGN.md` remains the design source of truth on its own — nothing in the core process depends on Figma being present.
