# Pipeline Dashboard

Committed Node tracking server + dashboard for the violin-tools feature pipeline.

Supersedes the legacy `tmp/dashboard/` Python tool (`server.py`, `dashboard.html`), which is
now retired. The Python `derive_status`, `classify_checks`, and `pick_pr_for_issue` logic is
ported verbatim in behavior into `server.js`.

## Run (on-demand; no always-on cron)

```sh
cd tools/pipeline-dashboard
npm install            # or: pnpm install (no workspace gate; standalone package)
node server.js         # defaults to http://127.0.0.1:8765/
```

Or from the repo root:

```sh
node tools/pipeline-dashboard/server.js --port 8765
```

Then open **http://127.0.0.1:8765/** in a browser.

## Requirements

- **Node.js ≥ 22.13.0** (the repo's pinned version).
- **`gh`** (GitHub CLI) installed and **authenticated** (`gh auth status`).
  The server reads issues, PRs, and the latest `main` CI run via `gh`.
  If `gh` is missing or unauthenticated the page still loads and shows a red
  banner; the server never 500s.

## CLI flags

| Flag | Default | Description |
|---|---|---|
| `--port` / `-p` | `8765` | TCP port to listen on |
| `--host` | `127.0.0.1` | Interface address to bind (`127.0.0.1` = loopback only; `0.0.0.0` = all interfaces) |
| `--brief` | see below | Absolute path to the brainstorm brief file |

**Warning:** passing `0.0.0.0` exposes gh-derived repo status to every host on the local network.

`BRAINSTORM_BRIEF_PATH` env var is an alternative to `--brief`.
Default brief path: `../../tmp/docs/pipeline-infra-brief.md` (relative to server.js).

## Two-layer architecture

1. **PRIMARY — `gh` poll (ground truth, ~25s cache).**
   Fetches issues + PRs + latest `main` CI run from GitHub. The last-good payload
   is retained across cache misses so the page never shows blank data on a transient
   `gh` failure. A `gh` error is surfaced as an `error` field (HTTP 200, never 500).

2. **ADDITIVE — fire-and-forget SSE (`/api/events`).**
   The workflow engine (P5) POSTs typed events to `POST /api/runs/:runId/events`.
   The server appends to an in-process log and broadcasts over SSE. A POST failure
   must never break the workflow. SSE is never the primary signal — it only adds
   fine-grained detail with no `gh` artifact yet.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Dashboard HTML |
| `GET` | `/api/config` | P1 `pipeline.json` stage taxonomy (200 + error on read failure) |
| `GET` | `/api/status` | gh-poll payload; `?force=1` bypasses cache |
| `POST` | `/api/runs/:runId/events` | Ingest typed event envelope; 201 + `{id}` |
| `GET` | `/api/events` | SSE stream; replays on reconnect (no-gap-no-duplicate) |

### Event envelope shape

```json
{
  "type": "run_start|phase_start|phase_end|agent_start|agent_end|log|run_end",
  "runId": "my-run-id",
  "phase": "phase-7-implement",
  "agentId": "implementer-p2",
  "label": "optional human label",
  "status": "done|dispatched|skipped|warning|success",
  "payload": {},
  "timestamp": "2026-06-09T12:00:00Z"
}
```

### Status payload shape

```json
{
  "fetchedAt": "2026-06-09T12:00:00Z",
  "ageSeconds": 12,
  "epic": { "number": 114, "title": "...", "state": "OPEN", "url": "..." },
  "brainstorm": { "status": "done|not_started", "source": "brief_file|epic_present|brief_absent", "briefPath": "tmp/docs/..." },
  "steps": [{ "s": 5, "issue": 42, "title": "S5 ...", "status": "merged", ... }],
  "counts": { "merged": 3, "inFlight": 1, "notStarted": 8, "total": 12 },
  "mainCi": { "status": "completed", "conclusion": "success", ... },
  "error": "optional: gh not authenticated"
}
```

## Dashboard

The dashboard renders **two distinct axes**, never conflated:

- **Pipeline phases** — config-driven cards from `/api/config` (P1 `pipeline.json`),
  keyed by `pipeline.json` stage `id`/`order`. SSE `phase_start` activates the
  matching card. An unmapped SSE phase ID (no matching config entry) is surfaced
  loudly with a visible flag.

- **Build steps (gh)** — `gh`-derived `S<n>` issue/PR cards, keyed by the integer
  parsed from the `^\s*S(\d+)\b` title regex. This axis is entirely separate; no
  `S<n>` step maps to a `pipeline.json` phase entry.

## Dependency

`express@4.22.2` — published by the [expressjs](https://www.npmjs.com/package/express)
org on npm; real publisher, 14+ years of release history, ~30M weekly downloads.
SSE is hand-rolled (~30 lines) — no SSE library dependency.

This package is **not** part of the pnpm workspace, `turbo.json` task graph, or
the four CI gates. It is standalone tooling.
