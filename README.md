# Violin Tools

A web app of focused practice tools for violinists. The first tool is **Scales** — a whole-neck fingerboard note map that shows where every note of a scale falls across the entire fingerboard at a glance. A second tool, the **Tuner**, is a live, microphone-based chromatic tuner.

**Microphone & privacy.** The Tuner listens through your microphone, but the audio is processed **entirely on-device, in your browser** — nothing is recorded, stored, or sent anywhere. There is no backend, so the audio never leaves your machine.

## Status: shipped — v1 is live at [strings-solo.com](https://strings-solo.com)

Violin Tools v1 is live. The **Scales** note map — the whole-neck fingerboard view, scale-aware note spelling, reference overlays, motion, the ⌘K command palette, and the accessibility + mobile-reflow passes — is built against [`DESIGN.md`](./DESIGN.md) (the spec for the whole thing: token system, color and contrast, typography, motion, components, accessibility, and the fingerboard note-map model) and deployed.

**Install and run locally:**

```sh
pnpm install      # install workspace deps (the monorepo uses pnpm + Turborepo)
pnpm dev          # run apps/web locally (Vite dev server)
pnpm build        # build the static bundle to apps/web/dist/
```

The four CI gates are `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build`; a separate soft Playwright suite (`pnpm test:e2e`) covers motion, accessibility, mobile reflow, and the v1 acceptance + visual flows. See [`AGENTS.md`](./AGENTS.md) → "Working in the tree" for the full command set.

**Hosting (lean, ~$0/mo):** it's a client-side static web app — no backend, no accounts, no personal data, no analytics. The built bundle is published to a public-read Google Cloud Storage bucket; a free **Cloudflare Worker** fronts it at the edge (TLS + CDN + the `www`→apex 301). There is **no GCP load balancer or Cloud CDN** — those were deferred for cost and can be added in front of the same bucket if traffic or latency metrics ever justify it. Deploys are keyless: a GitHub Actions workflow ([`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)) authenticates to GCP via Workload Identity Federation (no service-account JSON key) and syncs the bundle on every push to `main`. The hosting IaC lives in [`infra/`](./infra/) — see [`infra/README.md`](./infra/README.md).

## Where things live

- **[`DESIGN.md`](./DESIGN.md)** — the design source of truth. It wins on any design conflict, and it also defines the note-map's pitch model. Read it before any UI work.
- **[`AGENTS.md`](./AGENTS.md)** — how the project is built: conventions, the PR/review process, agent guardrails, and the rules for keeping docs current. Source of truth for project and process; `DESIGN.md` outranks it on design.
- **[`SECURITY.md`](./SECURITY.md)** — how to report a security problem, privately, and what to honestly expect back.

## How it's built

Most of the code here is written by AI coding agents, under human review, and squash-merged through pull requests. Every PR gets a real review before it lands — never a rubber-stamp. That development model is part of why the repo is public: the commit, PR, and review history is meant to be readable as a worked example of building software with agents.

## Why this repo is public

The maintainer would otherwise keep this private; it's public to capture four specific benefits — (a) the blog at [detached-node.dev](https://detached-node.dev) links to real, live code; (b) the commit/PR/review trail demonstrates how the maintainer builds with AI agents; (c) public repos get free or better CI, static-hosting, and dependency/secret/code scanning; (d) it showcases the design and engineering craft. Public is **not** the same as audit-grade: there's no compliance, regulatory, or external-auditability requirement, and none is implied by the source being visible. See [`SECURITY.md`](./SECURITY.md) for the full framing.

## License

MIT — see [`LICENSE`](./LICENSE).

