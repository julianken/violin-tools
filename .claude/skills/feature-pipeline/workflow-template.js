/**
 * workflow-template.js — adaptable pipeline template
 *
 * Use this file when a feature's pipeline SHAPE differs from the canonical
 * feature-pipeline.js (e.g. an extra review gate, no design pass, a different
 * fan-out structure). Copy it, adapt the marked sections, and wire it as a
 * new Workflow script in .claude/workflows/.
 *
 * This template is READ-AND-ADAPTED by a human or agent — it is NOT run
 * verbatim. The canonical engine for standard features is:
 *   .claude/workflows/feature-pipeline.js
 *
 * Adaptation points are marked with [ADAPT: ...] comments. Remove the marker
 * once you've made the decision; leave the comment if you're intentionally
 * keeping the default.
 *
 * Instance literals (repo slug, dashboard URL, port) are supplied via args
 * from the P1 schema — they are NOT hard-coded here so that P7 can mirror
 * this template to julianken/agentic-seed with {{placeholders}} for any
 * instance-specific value.
 *
 * -----------------------------------------------------------------------------
 * How to use this template:
 * 1. Copy to .claude/workflows/<your-workflow-name>.js
 * 2. Update meta.name and meta.description.
 * 3. Walk the PHASES object — remove phases your feature skips; add phases it
 *    needs.
 * 4. Update PHASE_MODEL entries to match your phase list.
 * 5. Implement each phase function, following the patterns:
 *    - Read gh ground truth at entry → return early if already done (idempotent).
 *    - Dispatch leaf workers with dispatch(); never copy their bodies.
 *    - Emit phase_start / phase_end SSE envelopes.
 *    - Route non-progress to resolveBlocker().
 * 6. Wire phases into run() in your desired sequence.
 * 7. Keep REQUIRED_ARGS in sync with .claude/workflows/schemas/feature-pipeline.schema.json
 *    (or author your own schema if the args contract differs).
 * -----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// meta — consumed by the Claude Code Workflow runtime (v2.1.154+)
// ---------------------------------------------------------------------------

export const meta = {
  // [ADAPT: rename to your workflow]
  name: "my-feature-pipeline",
  // [ADAPT: describe what this variant does differently]
  description:
    "Adapted pipeline for <describe your variant>. " +
    "Based on feature-pipeline.js — see that file for the canonical shape.",

  // [ADAPT: reference your own schema if the args contract differs from P1's,
  //  or keep this pointer if the P1 schema covers your args.]
  schema: ".claude/workflows/schemas/feature-pipeline.schema.json",
};

// ---------------------------------------------------------------------------
// Required-arg set — keep identical to the P1 schema `required` array and
// to the P6 SKILL.md documented args list (three-copy no-drift rule).
// [ADAPT: add/remove only if your schema genuinely differs from P1's.]
// ---------------------------------------------------------------------------
const REQUIRED_ARGS = [
  "featureSlug",
  "epicSpecPath",
  "childSpecPaths",
  "repoSlug",
  "brainstormBriefPath",
];

// ---------------------------------------------------------------------------
// Phase constants
// [ADAPT: remove phases your feature skips; add phases it needs.
//  Keep numeric values unique and ascending. Phase 0 is always the
//  front-door (not engine-run); the engine runs phases 1+.]
// ---------------------------------------------------------------------------
const PHASES = {
  BRAINSTORM: 0,        // front-door — not engine-run; validated at phase 1
  VALIDATE: 1,          // [KEEP — every pipeline needs validate]
  EPIC_AUTHORING: 2,    // [ADAPT: remove if your feature has no epic]
  // FIGMA_DESIGN: 3,   // [OPTIONAL — uncomment for UI features only]
  // FIGMA_REVIEW: 4,   // [OPTIONAL — uncomment for UI features only]
  ISSUE_FAN_OUT: 5,     // [KEEP — creates child issues + epic]
  PLAN_REVIEW: 6,       // [KEEP — bot reviews every spec before implementation]
  IMPLEMENT: 7,         // [KEEP — implementer dispatch]
  PR_CREATE: 8,         // [KEEP — PR creation]
  PR_REVIEW: 9,         // [KEEP — per-HEAD PR-review loop]
  MERGE: 10,            // [KEEP — Mergify queue; NEVER gh pr merge]
  DEPLOY: 11,           // [ADAPT: remove if this feature doesn't deploy]
  // MY_EXTRA_PHASE: 12, // [ADAPT: add custom gates with a new number]
};

// Model routing per phase.
// Review/synthesis phases → opus; mechanical phases → sonnet. (AC20 in P5)
// [ADAPT: update when you add/remove phases.]
const PHASE_MODEL = {
  [PHASES.VALIDATE]: "sonnet",
  [PHASES.EPIC_AUTHORING]: "opus",
  // [PHASES.FIGMA_DESIGN]: "opus",
  // [PHASES.FIGMA_REVIEW]: "opus",
  [PHASES.ISSUE_FAN_OUT]: "sonnet",
  [PHASES.PLAN_REVIEW]: "opus",
  [PHASES.IMPLEMENT]: "sonnet",
  [PHASES.PR_CREATE]: "sonnet",
  [PHASES.PR_REVIEW]: "opus",
  [PHASES.MERGE]: "sonnet",
  [PHASES.DEPLOY]: "sonnet",
};

// Greppable token emitted by issue-plan-review (SKILL.md L65/L125).
// PR-review uses reviewDecision (structured gh field), not this token.
const PLAN_REVIEW_APPROVE_TOKEN = "Verdict: APPROVE";

// Figma verdict token — used only if FIGMA_REVIEW phase is active.
// [ADAPT: keep if uiFeature phases are enabled; remove otherwise.]
// const FIGMA_DESIGN_VERDICT_APPROVE_TOKEN = "Figma-Design-Verdict: APPROVE";

// RESOLUTION sub-workflow attempt cap per phase (AC18).
const RESOLUTION_MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Helpers (copy verbatim from feature-pipeline.js — keep in sync)
// ---------------------------------------------------------------------------

function resolveModel(phase, args) {
  if (args.model) return args.model;
  return PHASE_MODEL[phase] ?? "sonnet";
}

/**
 * emit — fire-and-forget SSE envelope. A POST failure NEVER breaks the run.
 * Control flow never reads this stream back.
 */
async function emit(dashboardBaseUrl, runId, type, payload = {}) {
  const url = `${dashboardBaseUrl}/api/runs/${runId}/events`;
  const envelope = { type, runId, timestamp: new Date().toISOString(), ...payload };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (_err) {
    console.warn(`[workflow-template] SSE emit failed (${type}): ${_err.message ?? _err}`);
  }
}

/** ghJson — fixed argument lists only; no shell interpolation. */
async function ghJson(args) {
  const result = await runCommand("gh", args);
  return JSON.parse(result.stdout);
}

async function runCommand(cmd, args) {
  // Uses execFile (not exec) — no shell interpolation; arg list passed directly
  // to the OS exec call. Satisfies AC14 and keeps this template's no-drift
  // relationship with the engine helper correct.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  return execFileAsync(cmd, args);
}

function fileExists(p) {
  const { existsSync } = require("node:fs");
  return existsSync(p);
}

function fileContains(filePath, token) {
  const { readFileSync } = require("node:fs");
  try {
    return readFileSync(filePath, "utf8").includes(token);
  } catch {
    return false;
  }
}

async function postAgentComment(repoSlug, number, body) {
  // AGENT: prefix marks AI authorship — never on literal machine commands.
  const prefixedBody = `AGENT: ${body}`;
  await runCommand("gh", [
    "api",
    `repos/${repoSlug}/issues/${number}/comments`,
    "-X", "POST",
    "-f", `body=${prefixedBody}`,
  ]);
}

function classifyChecks(statusCheckRollup) {
  if (!statusCheckRollup || statusCheckRollup.length === 0) return true;
  return statusCheckRollup.every(
    (c) => c.status === "COMPLETED" && c.conclusion === "SUCCESS"
  );
}

async function ghIssueHasApproveComment(repoSlug, issueNumber, token) {
  const comments = await ghJson([
    "api",
    `repos/${repoSlug}/issues/${issueNumber}/comments`,
    "--jq", "[.[].body]",
  ]);
  return Array.isArray(comments) && comments.some((body) => body.includes(token));
}

async function ghGetPrForIssue(repoSlug, issueNumber) {
  const prs = await ghJson([
    "pr", "list",
    "--repo", repoSlug,
    "--state", "all",
    "--json", "number,title,state,body",
    "--limit", "50",
  ]);
  const linked = prs.find(
    (pr) =>
      pr.body?.includes(`Closes #${issueNumber}`) ||
      pr.body?.includes(`closes #${issueNumber}`) ||
      pr.title?.includes(`#${issueNumber}`)
  );
  return linked ?? null;
}

// ---------------------------------------------------------------------------
// RESOLUTION sub-workflow — copy verbatim from feature-pipeline.js.
// Diagnose → fix → verify; bounded by RESOLUTION_MAX_ATTEMPTS.
// Escalates to HIL (AGENT:-prefixed comment) only when truly unresolvable.
// ---------------------------------------------------------------------------

async function resolveBlocker(args, runState, emit_, phase, description) {
  const counterKey = `resolution_attempts_phase_${phase}`;
  runState[counterKey] = (runState[counterKey] ?? 0) + 1;
  const attempt = runState[counterKey];

  await emit_("log", {
    phase,
    label: `RESOLUTION attempt ${attempt}/${RESOLUTION_MAX_ATTEMPTS}: ${description}`,
  });

  if (attempt > RESOLUTION_MAX_ATTEMPTS) {
    await postAgentComment(
      args.repoSlug,
      runState.epicIssueNumber ?? 0,
      `Phase ${phase} blocker unresolvable after ${RESOLUTION_MAX_ATTEMPTS} attempts: ${description}. ` +
        `Human review required — please diagnose and re-run the engine once resolved.`
    );
    throw new Error(`HIL_ESCALATED: phase=${phase} description="${description}"`);
  }

  await emit_("agent_start", { phase, agentId: "resolution-diagnose", label: `diagnose (attempt ${attempt})` });
  const diagnosis = await dispatch({ agent: "general-purpose", task: "diagnose-blocker", description, phase, repoSlug: args.repoSlug, model: "sonnet" });
  await emit_("agent_end", { phase, agentId: "resolution-diagnose", status: "done" });

  await emit_("agent_start", { phase, agentId: "resolution-fix", label: `fix (attempt ${attempt})` });
  await dispatch({ agent: "general-purpose", task: "fix-blocker", diagnosis, phase, repoSlug: args.repoSlug, isolation: "worktree", model: "sonnet" });
  await emit_("agent_end", { phase, agentId: "resolution-fix", status: "done" });

  await emit_("agent_start", { phase, agentId: "resolution-verify", label: `verify (attempt ${attempt})` });
  await dispatch({ agent: "general-purpose", task: "verify-fix", phase, repoSlug: args.repoSlug, model: "sonnet" });
  await emit_("agent_end", { phase, agentId: "resolution-verify", status: "done" });
}

// ---------------------------------------------------------------------------
// Dispatch + parallel (copy verbatim from feature-pipeline.js)
// ---------------------------------------------------------------------------

async function dispatch(opts) {
  if (typeof globalThis.__workflowDispatch === "function") {
    return globalThis.__workflowDispatch(opts);
  }
  console.log(`[dispatch] ${JSON.stringify(opts)}`);
  return { dispatched: true };
}

async function parallel(promises) {
  return Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Phase implementations — adaptation points
// [ADAPT: replace the body of each phase with your feature's logic, following
//  the idempotent gh-ground-truth pattern from feature-pipeline.js.
//  Each phase must:
//    (a) read gh ground truth at entry
//    (b) return early if the outcome already exists
//    (c) dispatch leaf workers with dispatch()
//    (d) emit phase_start / phase_end envelopes
//    (e) route non-progress to resolveBlocker()
// ]
// ---------------------------------------------------------------------------

/** phase1_validate — brief validation + project-bootstrap coherence. [KEEP — required] */
async function phase1_validate(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.VALIDATE, label: "Validate (brief + bootstrap)" });

  if (runState.phase1Done) {
    await emit_("phase_end", { phase: PHASES.VALIDATE, status: "skipped" });
    return;
  }

  // [KEEP] Brief must exist and carry the uiFeature: marker.
  if (!fileExists(args.brainstormBriefPath)) {
    throw new Error(`HALT: brainstormBriefPath does not exist: ${args.brainstormBriefPath}`);
  }
  if (!fileContains(args.brainstormBriefPath, "uiFeature:")) {
    throw new Error(`HALT: brainstormBriefPath lacks required 'uiFeature:' marker`);
  }
  runState.uiFeature =
    typeof args.uiFeature === "boolean"
      ? args.uiFeature
      : fileContains(args.brainstormBriefPath, "uiFeature: yes");

  await dispatch({
    skill: ".claude/skills/project-bootstrap/SKILL.md",
    mode: "validate",
    repoSlug: args.repoSlug,
    model: resolveModel(PHASES.VALIDATE, args),
  });

  runState.phase1Done = true;
  await emit_("phase_end", { phase: PHASES.VALIDATE, status: "done" });
}

/**
 * phase2_epicAuthoring — [ADAPT: remove if your feature has no separate epic.]
 * Dispatches epic-authoring (P3) to produce the tmp/docs/ epic spec.
 */
async function phase2_epicAuthoring(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.EPIC_AUTHORING, label: "Epic authoring" });

  if (fileExists(args.epicSpecPath)) {
    await emit_("phase_end", { phase: PHASES.EPIC_AUTHORING, status: "skipped" });
    return;
  }

  // [ADAPT: swap epic-authoring for your own synthesis skill if needed.]
  await dispatch({
    skill: ".claude/skills/epic-authoring/SKILL.md",
    brainstormBriefPath: args.brainstormBriefPath,
    epicSpecPath: args.epicSpecPath,
    featureSlug: args.featureSlug,
    uiFeature: runState.uiFeature,
    repoSlug: args.repoSlug,
    model: resolveModel(PHASES.EPIC_AUTHORING, args),
  });

  await emit_("phase_end", { phase: PHASES.EPIC_AUTHORING, status: "done" });
}

/**
 * phase5_issueFanOut — children first, epic last.
 * [ADAPT: if your feature has no epic, omit the epic dispatch block.
 *  If you need different child ordering, adjust the loop.]
 */
async function phase5_issueFanOut(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.ISSUE_FAN_OUT, label: "Issue fan-out" });

  // [OPTIONAL — uncomment for UI features]
  // const verdictFilePath = `tmp/docs/${args.featureSlug}/figma-verdict.txt`;
  // if (runState.uiFeature && !fileContains(verdictFilePath, FIGMA_DESIGN_VERDICT_APPROVE_TOKEN)) {
  //   throw new Error("PHASE_5_BLOCKED: Figma-Design-Verdict APPROVE not found");
  // }

  const childIssueNumbers = [];
  for (const specPath of args.childSpecPaths) {
    const result = await dispatch({
      skill: ".claude/skills/issue-authoring/SKILL.md",
      specPath,
      repoSlug: args.repoSlug,
      epicLinkPending: true,
      model: resolveModel(PHASES.ISSUE_FAN_OUT, args),
    });
    if (result?.issueNumber) childIssueNumbers.push(result.issueNumber);
  }
  runState.childIssueNumbers = childIssueNumbers;

  // [ADAPT: remove if your feature has no epic]
  const epicResult = await dispatch({
    skill: ".claude/skills/issue-authoring/SKILL.md",
    specPath: args.epicSpecPath,
    repoSlug: args.repoSlug,
    childIssueNumbers,
    isEpic: true,
    model: resolveModel(PHASES.ISSUE_FAN_OUT, args),
  });
  runState.epicIssueNumber = epicResult?.issueNumber;

  await emit_("phase_end", { phase: PHASES.ISSUE_FAN_OUT, status: "done" });
}

/**
 * phase6_planReview — children first, epic last; Verdict: APPROVE token match.
 * [ADAPT: keep as-is for the standard plan-review gate.]
 */
async function phase6_planReview(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.PLAN_REVIEW, label: "Plan review" });

  const reviewOrder = [
    ...(runState.childIssueNumbers ?? []),
    runState.epicIssueNumber,
  ].filter(Boolean);

  for (const issueNumber of reviewOrder) {
    const alreadyApproved = await ghIssueHasApproveComment(args.repoSlug, issueNumber, PLAN_REVIEW_APPROVE_TOKEN);
    if (alreadyApproved) continue;

    let approved = false;
    let attempts = 0;
    while (!approved && attempts < RESOLUTION_MAX_ATTEMPTS) {
      attempts++;
      await dispatch({
        agent: ".claude/agents/julianken-bot.md",
        skill: ".claude/skills/issue-plan-review/SKILL.md",
        issueNumber,
        repoSlug: args.repoSlug,
        model: resolveModel(PHASES.PLAN_REVIEW, args),
      });
      approved = await ghIssueHasApproveComment(args.repoSlug, issueNumber, PLAN_REVIEW_APPROVE_TOKEN);
      if (!approved) {
        await resolveBlocker(args, runState, emit_, PHASES.PLAN_REVIEW,
          `Plan review for issue #${issueNumber} returned REQUEST_CHANGES`);
      }
    }
    if (!approved) throw new Error(`PLAN_REVIEW_ESCALATED: issue #${issueNumber}`);
  }

  await emit_("phase_end", { phase: PHASES.PLAN_REVIEW, status: "done" });
}

/**
 * phase7_implement — parallel implementer dispatch, worktree-isolated.
 * [ADAPT: add dependency ordering if your children have intra-group deps.]
 */
async function phase7_implement(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.IMPLEMENT, label: "Implementation" });

  const prsNeeded = [];
  for (const issueNumber of runState.childIssueNumbers ?? []) {
    const pr = await ghGetPrForIssue(args.repoSlug, issueNumber);
    if (!pr) prsNeeded.push(issueNumber);
    else if (pr.number) runState.prByIssue = { ...(runState.prByIssue ?? {}), [issueNumber]: pr.number };
  }

  if (prsNeeded.length > 0) {
    await parallel(
      prsNeeded.map((issueNumber) =>
        dispatch({
          agent: "general-purpose",
          task: "implement-issue",
          issueNumber,
          repoSlug: args.repoSlug,
          isolation: "worktree",
          model: resolveModel(PHASES.IMPLEMENT, args),
        })
      )
    );
  }

  await emit_("phase_end", { phase: PHASES.IMPLEMENT, status: "done" });
}

/**
 * phase8_prCreate — PR creation.
 * [ADAPT: add screenshotsSkill: "pr-screenshots-via-user-attachments" for UI PRs.]
 */
async function phase8_prCreate(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.PR_CREATE, label: "PR creation" });

  for (const issueNumber of runState.childIssueNumbers ?? []) {
    const existing = await ghGetPrForIssue(args.repoSlug, issueNumber);
    if (existing) {
      runState.prByIssue = { ...(runState.prByIssue ?? {}), [issueNumber]: existing.number };
      continue;
    }
    const dispatchArgs = {
      skill: ".claude/skills/creating-prs/SKILL.md",
      issueNumber,
      repoSlug: args.repoSlug,
      uiFeature: runState.uiFeature,
      model: resolveModel(PHASES.PR_CREATE, args),
    };
    // [ADAPT: uncomment for UI features]
    // if (runState.uiFeature) dispatchArgs.screenshotsSkill = "pr-screenshots-via-user-attachments";
    const prResult = await dispatch(dispatchArgs);
    if (prResult?.prNumber) {
      runState.prByIssue = { ...(runState.prByIssue ?? {}), [issueNumber]: prResult.prNumber };
    }
  }

  await emit_("phase_end", { phase: PHASES.PR_CREATE, status: "done" });
}

/**
 * phase9_prReview — per-HEAD review loop.
 * reviewDecision is a STRUCTURED gh FIELD, not a comment token (AC10/12).
 * design-reviewer is dispatched in parallel() with julianken-bot on UI PRs (AC23).
 * [ADAPT: keep as-is unless your review gate differs.]
 */
async function phase9_prReview(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.PR_REVIEW, label: "PR review" });

  for (const [issueNumber, prNumber] of Object.entries(runState.prByIssue ?? {})) {
    let converged = false;
    let attempts = 0;

    while (!converged && attempts < RESOLUTION_MAX_ATTEMPTS) {
      attempts++;
      const prState = await ghJson([
        "pr", "view", String(prNumber),
        "--repo", args.repoSlug,
        "--json", "reviewDecision,statusCheckRollup,headRefOid",
      ]);

      const { reviewDecision, statusCheckRollup, headRefOid } = prState;
      const lastHead = runState.lastReviewedHead?.[prNumber];
      const headChanged = lastHead && lastHead !== headRefOid;

      if (reviewDecision === "APPROVED" && !headChanged && classifyChecks(statusCheckRollup)) {
        converged = true;
        break;
      }

      const reviewDispatch = [
        dispatch({
          agent: ".claude/agents/julianken-bot.md",
          skill: ".claude/skills/reviewing/SKILL.md",
          prNumber,
          repoSlug: args.repoSlug,
          headRefOid,
          model: resolveModel(PHASES.PR_REVIEW, args),
        }),
      ];
      // [ADAPT: uncomment for UI features]
      // if (runState.uiFeature) {
      //   reviewDispatch.push(dispatch({ agent: ".claude/agents/design-reviewer.md", prNumber, repoSlug: args.repoSlug, headRefOid, model: resolveModel(PHASES.PR_REVIEW, args) }));
      // }
      await parallel(reviewDispatch);
      runState.lastReviewedHead = { ...(runState.lastReviewedHead ?? {}), [prNumber]: headRefOid };

      const afterState = await ghJson([
        "pr", "view", String(prNumber),
        "--repo", args.repoSlug,
        "--json", "reviewDecision,statusCheckRollup,headRefOid",
      ]);
      if (afterState.reviewDecision === "APPROVED" && afterState.headRefOid === headRefOid && classifyChecks(afterState.statusCheckRollup)) {
        converged = true;
      } else {
        await resolveBlocker(args, runState, emit_, PHASES.PR_REVIEW,
          `PR #${prNumber}: reviewDecision is not APPROVED`);
      }
    }

    if (!converged) {
      await postAgentComment(args.repoSlug, prNumber,
        `PR #${prNumber} review did not converge after ${RESOLUTION_MAX_ATTEMPTS} attempts.`, "pr");
      throw new Error(`PR_REVIEW_ESCALATED: PR #${prNumber}`);
    }
  }

  await emit_("phase_end", { phase: PHASES.PR_REVIEW, status: "done" });
}

/**
 * phase10_merge — Mergify queue; NEVER gh pr merge. Epic closed last. (AC22, AC8)
 * [ADAPT: keep as-is — the merge trigger must be exactly "@Mergifyio queue".]
 */
async function phase10_merge(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.MERGE, label: "Merge via Mergify queue" });

  for (const [, prNumber] of Object.entries(runState.prByIssue ?? {})) {
    const state = await ghJson([
      "pr", "view", String(prNumber),
      "--repo", args.repoSlug,
      "--json", "mergedAt,state",
    ]);
    if (state.mergedAt || state.state === "MERGED") continue;

    // Exact body "@Mergifyio queue" — NEVER prefix with AGENT: (pr-workflow rule 6).
    await runCommand("gh", [
      "pr", "comment", String(prNumber),
      "--repo", args.repoSlug,
      "--body", "@Mergifyio queue",
    ]);
  }

  // [ADAPT: remove if your feature has no epic]
  if (runState.epicIssueNumber) {
    await runCommand("gh", [
      "issue", "close", String(runState.epicIssueNumber),
      "--repo", args.repoSlug,
    ]);
  }

  await emit_("phase_end", { phase: PHASES.MERGE, status: "done" });
}

/**
 * phase11_deployVerify — [ADAPT: remove or replace if your feature doesn't deploy.]
 */
async function phase11_deployVerify(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.DEPLOY, label: "Deploy verification" });

  const runs = await ghJson([
    "run", "list",
    "--repo", args.repoSlug,
    "--branch", "main",
    "--limit", "5",
    "--json", "databaseId,status,conclusion,name",
  ]);
  const deployRun = runs.find((r) => r.status === "completed");
  await emit_("log", {
    phase: PHASES.DEPLOY,
    label: deployRun?.conclusion === "success" ? "Deploy CI green" : "Deploy status unclear",
    payload: { run: deployRun },
  });

  await emit_("phase_end", { phase: PHASES.DEPLOY, status: "done" });
}

// ---------------------------------------------------------------------------
// Main entry point — [ADAPT: sequence phases to match your variant]
// ---------------------------------------------------------------------------

export async function run(args) {
  for (const key of REQUIRED_ARGS) {
    if (!args[key]) throw new Error(`Missing required arg: ${key}`);
  }

  const runState = {};
  const runId = args.runId ?? `run-${Date.now()}`;
  const dashboardBaseUrl = args.dashboardBaseUrl ?? "http://127.0.0.1:2025";
  const emit_ = (type, payload = {}) => emit(dashboardBaseUrl, runId, type, payload);

  await emit_("run_start", { featureSlug: args.featureSlug, repoSlug: args.repoSlug });

  try {
    // [ADAPT: add, remove, or reorder phases to match your pipeline shape.]
    await phase1_validate(args, runState, emit_);
    await phase2_epicAuthoring(args, runState, emit_);
    // await phase3_figmaDesign(args, runState, emit_);   // [OPTIONAL — UI-only]
    // await phase4_figmaReview(args, runState, emit_);   // [OPTIONAL — UI-only]
    await phase5_issueFanOut(args, runState, emit_);
    await phase6_planReview(args, runState, emit_);
    await phase7_implement(args, runState, emit_);
    await phase8_prCreate(args, runState, emit_);
    await phase9_prReview(args, runState, emit_);
    await phase10_merge(args, runState, emit_);
    await phase11_deployVerify(args, runState, emit_);
    // await myExtraPhase(args, runState, emit_);          // [ADAPT: custom gate]

    await emit_("run_end", { status: "success", featureSlug: args.featureSlug });
  } catch (err) {
    await emit_("run_end", { status: "error", error: err.message });
    throw err;
  }
}
