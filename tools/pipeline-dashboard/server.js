/**
 * Violin Tools — Pipeline tracking server + dashboard (P2)
 *
 * Two-layer architecture:
 *   1. PRIMARY (ground-truth): poll `gh` (~25s cached) for issue/PR/CI status.
 *      Last-good retained; a gh failure returns HTTP 200 + error field, never 500.
 *   2. ADDITIVE (in-flight): fire-and-forget SSE hub for typed workflow events.
 *      POST /api/runs/:runId/events → in-process log + broadcast.
 *      A POST failure MUST NOT break the workflow; this layer never replaces gh truth.
 *
 * Security posture: bind 127.0.0.1 only; all gh calls use execFile (fixed arg lists,
 * no shell: true, no request-input interpolation); no secrets emitted or logged.
 *
 * Run: node server.js [--port 8765]
 */

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────────
const REPO = "julianken/violin-tools";
const HOST = "127.0.0.1";
const CACHE_TTL_SECONDS = 25;
const GH_TIMEOUT_MS = 30_000;

const PIPELINE_JSON = resolve(__dirname, "pipeline.json");
const PUBLIC_DIR = resolve(__dirname, "public");
const DASHBOARD_HTML = join(PUBLIC_DIR, "dashboard.html");

// Default brainstorm brief path (overridable via BRAINSTORM_BRIEF_PATH env or --brief CLI arg)
const DEFAULT_BRIEF_PATH = resolve(
  __dirname,
  "../../tmp/docs/pipeline-infra-brief.md"
);

// ── gh helpers ───────────────────────────────────────────────────────────────
/**
 * Run `gh <args>` with a fixed argument list.
 * Returns [parsedJson, null] on success or [null, hintString] on any failure.
 * Never raises, never interpolates external input, never shell:true.
 * Token text is never echoed or surfaced in the hint.
 */
function runGh(args) {
  return new Promise((resolve) => {
    let timedOut = false;
    let child;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch (_) { /* already dead */ }
      resolve([null, "gh call timed out"]);
    }, GH_TIMEOUT_MS);

    try {
      child = execFile("gh", args, { shell: false }, (err, stdout, stderr) => {
        clearTimeout(timer);
        if (timedOut) return; // already resolved

        if (err) {
          const stderrText = (stderr || "").trim();
          let hint = stderrText.split("\n")[0] || `gh exited ${err.code ?? "?"}`;
          if (/auth|not log/i.test(stderrText)) hint = "gh not authenticated";
          // Log the full stderr to stderr, never to stdout/response
          process.stderr.write(
            `[dashboard] gh ${args.join(" ")} failed: ${stderrText.slice(0, 500)}\n`
          );
          return resolve([null, hint]);
        }

        try {
          resolve([JSON.parse(stdout || "null"), null]);
        } catch (_) {
          process.stderr.write(
            `[dashboard] JSON parse error for gh ${args.join(" ")}\n`
          );
          resolve([null, "gh returned invalid JSON"]);
        }
      });
    } catch (spawnErr) {
      clearTimeout(timer);
      if (spawnErr.code === "ENOENT") {
        return resolve([null, "gh CLI not found on PATH"]);
      }
      return resolve([null, "gh spawn failed: " + spawnErr.constructor.name]);
    }
  });
}

async function fetchIssues() {
  return runGh([
    "issue", "list", "--repo", REPO, "--state", "all", "--limit", "200",
    "--json", "number,title,state,stateReason,url",
  ]);
}

async function fetchPrs() {
  return runGh([
    "pr", "list", "--repo", REPO, "--state", "all", "--limit", "200",
    "--json",
    "number,title,state,isDraft,reviewDecision,statusCheckRollup,closingIssuesReferences,url,mergedAt",
  ]);
}

async function fetchMainCi() {
  const [data, err] = await runGh([
    "run", "list", "--repo", REPO, "--branch", "main", "--limit", "1",
    "--json", "status,conclusion,displayTitle,url,headSha",
  ]);
  if (err) {
    process.stderr.write(`[dashboard] mainCi unavailable: ${err}\n`);
    return null;
  }
  return Array.isArray(data) && data.length ? data[0] : null;
}

// ── Derivation (ported verbatim from Python tmp/dashboard/server.py) ─────────

const FAIL_STATES = new Set([
  "FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED",
]);
const PENDING_STATES = new Set([
  "PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED", "WAITING",
]);
const STEP_TITLE_RE = /^\s*S(\d+)\b/;
const EPIC_MARKER = "Violin Tools v1";

/** Map a statusCheckRollup array to "FAIL" | "PENDING" | "PASS" | "" */
function classifyChecks(rollup) {
  if (!Array.isArray(rollup) || rollup.length === 0) return "";
  let hasFail = false;
  let hasPending = false;
  for (const chk of rollup) {
    const values = ["conclusion", "state", "status"]
      .map((k) => (chk[k] ? String(chk[k]).toUpperCase() : null))
      .filter(Boolean);
    if (values.some((v) => FAIL_STATES.has(v))) hasFail = true;
    if (values.some((v) => PENDING_STATES.has(v))) hasPending = true;
  }
  if (hasFail) return "FAIL";
  if (hasPending) return "PENDING";
  return "PASS";
}

function prSortKey(pr) {
  return [pr.mergedAt ?? "", pr.number ?? 0];
}

function cmpPrKeys([a1, a2], [b1, b2]) {
  if (a1 < b1) return -1;
  if (a1 > b1) return 1;
  return a2 - b2;
}

/** Prefer MERGED, else OPEN, else most-recent by mergedAt/number */
function pickPrForIssue(issueNumber, prsByIssue) {
  const candidates = prsByIssue.get(issueNumber);
  if (!candidates || candidates.length === 0) return null;

  const stateOf = (pr) => (pr.state ?? "").toUpperCase();

  const merged = candidates.filter((p) => stateOf(p) === "MERGED");
  if (merged.length) {
    return merged.sort((a, b) => cmpPrKeys(prSortKey(b), prSortKey(a)))[0];
  }
  const open = candidates.filter((p) => stateOf(p) === "OPEN");
  if (open.length) {
    return open.sort((a, b) => cmpPrKeys(prSortKey(b), prSortKey(a)))[0];
  }
  return candidates.sort((a, b) => cmpPrKeys(prSortKey(b), prSortKey(a)))[0];
}

/**
 * Derive the step status string.
 * CLOSED+NOT_PLANNED → "closed" (never inflates merged count).
 * CLOSED+COMPLETED   → "merged".
 */
function deriveStatus(issueState, stateReason, pr, checks) {
  if ((issueState ?? "").toUpperCase() === "CLOSED") {
    if ((stateReason ?? "").toUpperCase() === "NOT_PLANNED") return "closed";
    return "merged";
  }
  if (!pr) return "not_started";
  const prState = (pr.state ?? "").toUpperCase();
  if (prState === "MERGED") return "merged";
  if (checks === "FAIL") return "ci_failing";
  const review = (pr.reviewDecision ?? "").toUpperCase();
  if (review === "CHANGES_REQUESTED") return "changes_requested";
  if (review === "APPROVED") return "approved";
  if (pr.isDraft) return "in_progress";
  return "in_review";
}

const s = (v) => (v == null ? "" : v);

/**
 * Build the full /api/status payload. Never raises; returns HTTP-200-safe shape.
 * @param {string} brainstormBriefPath
 */
async function buildPayload(brainstormBriefPath) {
  const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const payload = {
    fetchedAt,
    ageSeconds: 0,
    epic: null,
    steps: [],
    counts: { merged: 0, inFlight: 0, notStarted: 0, total: 0 },
    mainCi: null,
    brainstorm: null,
  };
  const errors = [];

  const [[issues, ierr], [prs, perr]] = await Promise.all([
    fetchIssues(),
    fetchPrs(),
  ]);

  if (ierr) errors.push("issues: " + ierr);
  if (perr) errors.push("prs: " + perr);

  const issueList = issues ?? [];
  const prList = prs ?? [];

  // Index PRs by every issue number they close.
  const prsByIssue = new Map();
  for (const pr of prList) {
    for (const ref of pr.closingIssuesReferences ?? []) {
      const num = ref.number;
      if (num != null) {
        if (!prsByIssue.has(num)) prsByIssue.set(num, []);
        prsByIssue.get(num).push(pr);
      }
    }
  }

  // Epic: first issue whose title contains the marker.
  for (const issue of issueList) {
    if ((issue.title ?? "").includes(EPIC_MARKER)) {
      payload.epic = {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.url,
      };
      break;
    }
  }

  // Brainstorm stage status (AC20a/20b):
  // 1. If epic issue exists → brainstorm is necessarily done (gh-side corroborator).
  // 2. Else fs-stat the brief file.
  if (payload.epic) {
    payload.brainstorm = { status: "done", source: "epic_present" };
  } else {
    try {
      await stat(brainstormBriefPath);
      // File exists → done, include a relative display path
      const displayPath = brainstormBriefPath.replace(
        new RegExp("^" + resolve(__dirname, "../..") + "/"),
        ""
      );
      payload.brainstorm = {
        status: "done",
        source: "brief_file",
        briefPath: displayPath,
      };
    } catch (_) {
      payload.brainstorm = { status: "not_started", source: "brief_absent" };
    }
  }

  // Steps: issues matching ^\s*S(\d+)\b
  const steps = [];
  for (const issue of issueList) {
    const title = issue.title ?? "";
    const m = STEP_TITLE_RE.exec(title);
    if (!m) continue;
    const sNum = parseInt(m[1], 10);
    const issueState = issue.state ?? "";
    const stateReason = issue.stateReason ?? "";
    const pr = pickPrForIssue(issue.number, prsByIssue);
    const checks = classifyChecks(pr ? pr.statusCheckRollup : null);
    const status = deriveStatus(issueState, stateReason, pr, checks);
    steps.push({
      s: sNum,
      issue: issue.number,
      title,
      issueState,
      issueUrl: s(issue.url),
      status,
      prNumber: pr ? s(pr.number) : "",
      prState: pr ? s(pr.state) : "",
      reviewDecision: pr ? s(pr.reviewDecision) : "",
      checks: pr ? checks : "",
      prUrl: pr ? s(pr.url) : "",
    });
  }
  steps.sort((a, b) => a.s - b.s);
  payload.steps = steps;

  // Counts — explicit allow-list for in-flight (never miscounts closed/not-planned).
  const IN_FLIGHT_STATES = new Set([
    "approved", "in_review", "in_progress", "ci_failing", "changes_requested",
  ]);
  const total = steps.length;
  const merged = steps.filter((s) => s.status === "merged").length;
  const notStarted = steps.filter((s) => s.status === "not_started").length;
  const inFlight = steps.filter((s) => IN_FLIGHT_STATES.has(s.status)).length;
  payload.counts = { total, merged, notStarted, inFlight };

  // Best-effort main CI.
  try {
    payload.mainCi = await fetchMainCi();
  } catch (_) {
    payload.mainCi = null;
  }

  if (errors.length) payload.error = errors.join("; ");

  return payload;
}

// ── Status cache ─────────────────────────────────────────────────────────────
class StatusCache {
  #ttlMs;
  #payload = null;
  #fetchedMonotonic = 0;
  #inflight = null; // deduplicate concurrent fetches
  #brainstormBriefPath;

  constructor(ttlSeconds, brainstormBriefPath) {
    this.#ttlMs = ttlSeconds * 1000;
    this.#brainstormBriefPath = brainstormBriefPath;
  }

  async get(force = false) {
    const now = performance.now();
    const age = now - this.#fetchedMonotonic;

    if (!force && this.#payload && age < this.#ttlMs) {
      return { ...this.#payload, ageSeconds: Math.round(age / 1000) };
    }

    // Deduplicate concurrent force/miss fetches
    if (!this.#inflight) {
      this.#inflight = buildPayload(this.#brainstormBriefPath)
        .then((p) => {
          this.#payload = p;
          this.#fetchedMonotonic = performance.now();
          return p;
        })
        .catch((err) => {
          process.stderr.write(
            `[dashboard] buildPayload crashed: ${err.constructor.name}\n`
          );
          return {
            fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
            ageSeconds: 0,
            epic: null,
            brainstorm: null,
            steps: [],
            counts: { merged: 0, inFlight: 0, notStarted: 0, total: 0 },
            mainCi: null,
            error: "internal error building status",
          };
        })
        .finally(() => { this.#inflight = null; });
    }

    const fresh = await this.#inflight;
    return { ...fresh, ageSeconds: 0 };
  }
}

// ── SSE hub ───────────────────────────────────────────────────────────────────
const VALID_EVENT_TYPES = new Set([
  "run_start", "phase_start", "phase_end",
  "agent_start", "agent_end", "log", "run_end",
]);

let sseEventId = 0;
/** @type {{ id: number; data: object }[]} */
const sseEventLog = [];
/** @type {Set<import("http").ServerResponse>} */
const sseSubscribers = new Set();

function broadcastSse(event) {
  const frame = `id:${event.id}\ndata:${JSON.stringify(event)}\n\n`;
  for (const res of sseSubscribers) {
    try {
      res.write(frame);
    } catch (_) {
      sseSubscribers.delete(res);
    }
  }
}

function ingestEvent(envelope) {
  const id = ++sseEventId;
  const event = { id, ...envelope };
  sseEventLog.push(event);
  broadcastSse(event);
  return event;
}

/** Register an SSE subscriber, replay catch-up, then stream new events. */
function registerSseSubscriber(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Catch-up: no-gap-no-duplicate invariant.
  const lastId = req.headers["last-event-id"]
    ? parseInt(req.headers["last-event-id"], 10)
    : null;

  const catchUp =
    lastId == null
      ? sseEventLog            // fresh connect: replay all
      : sseEventLog.filter((e) => e.id > lastId); // reconnect: only newer

  for (const event of catchUp) {
    try {
      res.write(`id:${event.id}\ndata:${JSON.stringify(event)}\n\n`);
    } catch (_) {
      return; // client gone during replay
    }
  }

  sseSubscribers.add(res);

  const cleanup = () => {
    sseSubscribers.delete(res);
  };
  req.on("close", cleanup);
  req.on("error", cleanup);
}

// ── Express app ───────────────────────────────────────────────────────────────
async function createApp(brainstormBriefPath) {
  const cache = new StatusCache(CACHE_TTL_SECONDS, brainstormBriefPath);
  const app = express();
  app.use(express.json({ limit: "64kb" }));

  // GET / → serve dashboard.html
  app.get("/", async (_req, res) => {
    try {
      const html = await readFile(DASHBOARD_HTML);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(html);
    } catch (err) {
      process.stderr.write(`[dashboard] cannot read dashboard.html: ${err.message}\n`);
      res.status(500).type("text").send("dashboard.html not found");
    }
  });

  // GET /api/config → serve pipeline.json (P1)
  app.get("/api/config", async (_req, res) => {
    try {
      const raw = await readFile(PIPELINE_JSON, "utf8");
      const data = JSON.parse(raw);
      res.setHeader("Cache-Control", "no-store");
      res.json(data);
    } catch (err) {
      process.stderr.write(`[dashboard] cannot read pipeline.json: ${err.message}\n`);
      res.json({ error: "pipeline.json unavailable: " + err.message });
    }
  });

  // GET /api/status → gh-poll ground truth
  app.get("/api/status", async (req, res) => {
    const force = req.query.force === "1" || req.query.force === "true";
    try {
      const payload = await cache.get(force);
      res.setHeader("Cache-Control", "no-store");
      res.json(payload);
    } catch (err) {
      // Belt-and-suspenders: cache.get already guards internally.
      process.stderr.write(`[dashboard] status route crashed: ${err.constructor.name}\n`);
      res.json({
        fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        ageSeconds: 0,
        epic: null,
        brainstorm: null,
        steps: [],
        counts: { merged: 0, inFlight: 0, notStarted: 0, total: 0 },
        mainCi: null,
        error: "internal error building status",
      });
    }
  });

  // POST /api/runs/:runId/events → ingest typed envelope
  app.post("/api/runs/:runId/events", (req, res) => {
    try {
      const { runId } = req.params;
      if (!runId || typeof runId !== "string") {
        return res.status(400).json({ error: "missing runId" });
      }

      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "body must be a JSON object" });
      }
      if (!VALID_EVENT_TYPES.has(body.type)) {
        return res.status(400).json({
          error: `invalid type; must be one of: ${[...VALID_EVENT_TYPES].join(", ")}`,
        });
      }

      const envelope = { ...body, runId };
      const event = ingestEvent(envelope);
      res.status(201).json({ id: event.id });
    } catch (err) {
      // Never crash the server on a bad POST.
      process.stderr.write(`[dashboard] ingest error: ${err.message}\n`);
      res.status(400).json({ error: "ingest failed" });
    }
  });

  // GET /api/events → SSE stream
  app.get("/api/events", (req, res) => {
    registerSseSubscriber(req, res);
  });

  return app;
}

// ── Entry point ───────────────────────────────────────────────────────────────
const { values: cliArgs } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", short: "p", default: "8765" },
    brief: { type: "string", default: "" },
  },
  strict: false,
});

const port = parseInt(cliArgs.port ?? "8765", 10);
const brainstormBriefPath =
  cliArgs.brief || process.env.BRAINSTORM_BRIEF_PATH || DEFAULT_BRIEF_PATH;

const app = await createApp(brainstormBriefPath);
const server = createServer(app);

server.listen(port, HOST, () => {
  const url = `http://${HOST}:${port}/`;
  console.log(`Violin Tools — Pipeline dashboard serving at ${url}`);
  console.log(`  GET /api/config   pipeline stage taxonomy (P1 pipeline.json)`);
  console.log(`  GET /api/status   gh-poll ground truth (${CACHE_TTL_SECONDS}s cache; ?force=1 to bypass)`);
  console.log(`  POST /api/runs/:runId/events   ingest in-flight workflow events`);
  console.log(`  GET /api/events   SSE stream (replay on reconnect)`);
  console.log(`  Ctrl-C to stop.`);
});

server.on("error", (err) => {
  process.stderr.write(`[dashboard] server error: ${err.message}\n`);
  process.exit(1);
});
