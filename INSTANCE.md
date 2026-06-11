# INSTANCE.md

<!-- INSTANCE FACTS for this specific product/repo: what it is, its GitHub identity,
its Figma design file, and its merge/review infra. AGENTS.md is the source of truth
for PROCESS (how agents work); this file is the source of truth for INSTANCE (which
product, which repo, which Figma file, which merge setup). DESIGN.md remains the
source of truth for design. Keep process rules out of this file — they belong in
AGENTS.md so the process shape stays portable across products. -->

## What this is
Violin Tools — a web app of focused practice tools for violinists. Its first tool is **Scales**, a whole-neck fingerboard note map. Client-side static web app, built largely by AI coding agents through reviewed, squash-merged PRs.

## Status
**Status: shipped — v1 is LIVE at https://strings-solo.com.** The Scales note map is built and deployed (verified: HTTP/2 200 serving the app over TLS, `www`→apex 301, hashed assets immutable / `index.html` no-cache). The foundation (S1, #36) landed a Turborepo + pnpm-workspaces monorepo with `apps/web` (React + Vite + TS) and the four CI gates (`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build`); S5–S15 built the tool (note map, controls, overlays, motion, command palette, accessibility, mobile reflow, scale-aware spelling); S13 (#47, this capstone) added the acceptance E2E + visual gates and flipped this status. The real build/test/run commands live in `AGENTS.md` → "Working in the tree"; agents claim only commands that are actually wired (the tool-agnostic rule is `AGENTS.md` → "Agent guardrails" → anti-invention).

**Hosting (as shipped):** a client-side static SPA on a **public-read GCS bucket fronted by a free Cloudflare Worker** (`strings-solo-web`) that provides edge TLS + CDN + the `www`→apex 301 — the lean ~$0/mo architecture (S12 amendment, #39, 2026-06-07). There is **no GCP load balancer / Cloud CDN / managed end-to-end TLS** — it was deferred for cost; the LB is additive later in front of the same bucket if traffic/latency metrics justify it. Deploys are keyless via WIF (`.github/workflows/deploy.yml`, no SA JSON key); IaC in `infra/` (see `infra/README.md`). The Cloudflare Worker is deployed out-of-band (via the Cloudflare API / MCP, no committed token); `infra/cloudflare/worker.js` is kept in sync with the live Worker.

## Repo identity
Local folder `violin-scales/`; GitHub slug `julianken/violin-tools` — they differ, so pass the slug to `gh`. Default branch `main`.

## Design / Figma (scoped writes)

`DESIGN.md` is the source of truth for design (see AGENTS.md → "Design source of truth" for the authority ranking). The instance facts about *this product's* Figma file live here.

The design system lives in Figma (file `HWmo5hCeSXWtkSBiO1msIF`). Read it via the Figma MCP read tools — `get_metadata`, `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map`, `get_libraries`, `search_design_system`, `whoami`.

**Scoped writes (changed 2026-06-07; was read-only).** Figma is now the working board for features going forward, so agents MAY call Figma **write** tools (`use_figma`, `create_new_file`, `upload_assets`, and the generators `generate_figma_design` / `generate_diagram`) — but **only on a designated feature/WIP page** (one page per feature, e.g. `Scales — Note Map`; see the Node map below). The shared **system pages are off-limits to agent writes** and stay human-edited: **Foundations, Components, States, Motion, Annotations, and the existing Screens boards.** Load the `/figma-use` skill before any `use_figma` call, build idempotently (name-/`setSharedPluginData`-keyed so a re-run never duplicates), and verify the result with read tools. `add_code_connect_map` / Code Connect remain out of scope. The authority rule below is unchanged and binding: **values flow `DESIGN.md` §0 → Figma, never Figma → build.**

**Authority:** shipped build > `DESIGN.md` > Figma. `DESIGN.md` wins on any design conflict; a live Figma value that disagrees with it does **not** bind the build — it's *drift to reconcile into `DESIGN.md` §0 in a PR*. Never build straight from a live Figma node, and don't paste its raw hexes/Tailwind — translate to `DESIGN.md` tokens. The two do not auto-sync.

**Flow:** for a known node call `get_design_context` directly; for a large/unknown subtree call `get_metadata(<node>)` first to scope, then `get_design_context`; use `get_screenshot` for visual reference. A URL's `?node-id=45-2` is tool `nodeId: 45:2` (hyphen → colon).

**Node map** — URL form `https://figma.com/design/HWmo5hCeSXWtkSBiO1msIF/?node-id=<n-n>`. Pages: Foundations `1-2` · Components `1-3` · Screens `1-4` · States `1-5` · Motion `1-6` · Annotations `1-7` · Colors/Dark specimen `30-4` · **Scales — Note Map `98-2`** (the first per-feature WIP page — agent-writable per the scoped-writes rule above) · **WIP · Tuner (agent) `152-2`** (the S18 Tuner per-feature WIP page — agent-writable) · **WIP · Intonation (agent) `174-2`** (the Intonation epic per-feature WIP page — agent-writable). Screens: A Major `45-2` · A Harmonic Minor `23-2` · A Chromatic `23-408` · ⌘K Command Palette `25-2`. Scales — Note Map frames (the 2026-06-07 mobile-first redesign): Mobile Vertical·Comfort·Right default `98-3` · Mobile sheet-expanded `101-2` · Desktop Horizontal·Fit·Right unified `104-2` · Mobile Vertical·Fit `109-2` · Mobile Vertical·Comfort·Left (mirror) `110-2` · Mobile Horizontal landscape `112-2`. WIP · Tuner frames: Mobile in-tune `153-2` · Mobile off `154-2` · Mobile idle `155-2` · Mobile denied `156-2` · Desktop in-tune `157-2`. WIP · Intonation frames (verified 2026-06-10 via `get_metadata`): Mobile running `175-2` · Mobile summary `179-2` · Mobile idle/start `181-2` · Desktop running `182-2` · Desktop summary `187-2`. **MCP quirk:** `get_metadata` with no node-id lists only the Cover, so always pass an explicit node-id from this map. Node-ids are drift-prone (a frame rename/reorder can renumber them) — the Update-Triggers row, not the ids, is the safety net. Live Variable reads and Code Connect are unavailable on the current Figma plan (`get_variable_defs` → `{}`); treat Figma as visual reference, not a token feed.

## Merge / review infra
- **Mergify is in use** (`.mergify.yml`): an approved PR squash-merges through the queue via a standalone `@Mergifyio queue` comment. The merge *method* and its invariants are process — see `.claude/skills/pr-workflow/SKILL.md` and the user-level `mergify-merge-workflow` skill.
- **`@julianken-bot` is the sole non-author reviewer.** Direct push to `main` is blocked by a GitHub ruleset requiring 1 fresh approving review per HEAD from a non-author collaborator; the owner (`@julianken`, the lone code owner in `.github/CODEOWNERS`) authors PRs and can't self-approve, so `@julianken-bot` — the only other collaborator — is what unblocks merge.
