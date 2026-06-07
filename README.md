# Violin Tools

A web app of focused practice tools for violinists. The first tool is **Scales** — a whole-neck fingerboard note map that shows where every note of a scale falls across the entire fingerboard at a glance.

## Status: in development — builds and runs locally, not yet live

The foundation is in place: a Turborepo + pnpm-workspaces monorepo whose `apps/web` is a React + Vite + TypeScript app that builds to static assets, gated in CI by `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build`. You can install and run it locally — see [`AGENTS.md`](./AGENTS.md) → "Working in the tree" for the commands. The product UI is still being built against [`DESIGN.md`](./DESIGN.md) (the spec for the whole thing — token system, color and contrast, typography, motion, components, accessibility, and the fingerboard note-map model). The hosting infrastructure is now defined as code in [`infra/`](./infra/) — Cloudflare's free edge fronting a public-read static-asset bucket, with a keyless CI deploy pipeline — but it is **not applied yet**, so nothing is **live**.

It's a client-side static web app: no backend, no accounts, no personal data, no analytics.

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

