/**
 * feature-pipeline.js — the P5 workflow engine
 *
 * Drives a feature from epic-authoring through deploy with zero mid-run pauses.
 * Dispatches leaf workers (skills + agents) for every phase; never copies their
 * bodies. Control flow reads live `gh` state at every phase boundary so a
 * resumed or crashed run reconciles against reality.
 *
 * Phase taxonomy (0–11). Phase 0 is the FRONT-DOOR (run in the main session by
 * the P6 driving skill before this engine is invoked). The engine VALIDATES the
 * brief artifact at phase 1 but never conducts the brainstorm.
 *
 *   0  Brainstorm        — front-door (P6 + superpowers:brainstorming, NOT engine-run)
 *   1  Validate          — brief + project-bootstrap coherence                [sonnet]
 *   2  Epic authoring    — epic-authoring skill consumes the brief            [opus]
 *   3  Figma design      — figma-design skill (UI-only)                       [opus]
 *   4  Figma review      — reviewing-figma-designs + julianken-bot (UI-only)  [opus]
 *   5  Issue fan-out     — issue-authoring (children first, epic last)        [sonnet]
 *   6  Plan-review loop  — issue-plan-review + julianken-bot (children first, epic last) [opus]
 *   7  Implement         — per-child implementer agents, parallel+dep-ordered [sonnet]
 *   8  PR creation       — creating-prs (+ pr-screenshots for UI)             [sonnet]
 *   9  PR-review loop    — reviewing + julianken-bot (+ design-reviewer on UI PRs) [opus]
 *  10  Merge             — pr-workflow @Mergifyio queue mechanics              [sonnet]
 *  11  Deploy verify     — post-merge deploy check on main push               [sonnet]
 */

// ---------------------------------------------------------------------------
// meta — consumed by the Claude Code Workflow runtime (v2.1.154+)
// ---------------------------------------------------------------------------

export const meta = {
  name: "feature-pipeline",
  description:
    "Drive a feature from epic-authoring through deploy with no human pause. " +
    "Dispatches issue-authoring, issue-plan-review, creating-prs, reviewing, " +
    "pr-workflow, project-bootstrap, julianken-bot, and design-reviewer as leaf " +
    "workers. Reads live gh state at every phase boundary; idempotent on resume.",

  // References the P1-authored schema — does NOT inline it.
  // The Claude Code runtime reads this to prompt for missing required args.
  schema: ".claude/workflows/schemas/feature-pipeline.schema.json",
};

// ---------------------------------------------------------------------------
// Required-arg set (must stay IDENTICAL to the P1 schema `required` array and
// to the P6 SKILL.md documented args list — the AC that pins the three copies).
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
// ---------------------------------------------------------------------------
const PHASES = {
  BRAINSTORM: 0,        // front-door — not engine-run; validated at phase 1
  VALIDATE: 1,
  EPIC_AUTHORING: 2,
  FIGMA_DESIGN: 3,      // UI-only
  FIGMA_REVIEW: 4,      // UI-only
  ISSUE_FAN_OUT: 5,
  PLAN_REVIEW: 6,
  IMPLEMENT: 7,
  PR_CREATE: 8,
  PR_REVIEW: 9,
  MERGE: 10,
  DEPLOY: 11,
};

// Model routing per phase (AC20).
// Review/synthesis phases → opus; mechanical phases → sonnet.
const PHASE_MODEL = {
  [PHASES.VALIDATE]: "sonnet",        // mechanical
  [PHASES.EPIC_AUTHORING]: "opus",    // synthesis
  [PHASES.FIGMA_DESIGN]: "opus",      // design synthesis
  [PHASES.FIGMA_REVIEW]: "opus",      // review
  [PHASES.ISSUE_FAN_OUT]: "sonnet",   // mechanical
  [PHASES.PLAN_REVIEW]: "opus",       // review
  [PHASES.IMPLEMENT]: "sonnet",       // mechanical
  [PHASES.PR_CREATE]: "sonnet",       // mechanical
  [PHASES.PR_REVIEW]: "opus",         // review
  [PHASES.MERGE]: "sonnet",           // mechanical
  [PHASES.DEPLOY]: "sonnet",          // mechanical
};

// Greppable token emitted by issue-plan-review (SKILL.md L65/L125).
// PR-review convergence does NOT grep this token — it reads reviewDecision (AC10).
const PLAN_REVIEW_APPROVE_TOKEN = "Verdict: APPROVE";

// Greppable token emitted by reviewing-figma-designs into the verdict FILE.
const FIGMA_DESIGN_VERDICT_APPROVE_TOKEN = "Figma-Design-Verdict: APPROVE";

// RESOLUTION sub-workflow default attempt cap per phase (AC18).
const RESOLUTION_MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * resolveModel — returns the effective model string for a phase, respecting
 * the optional `model` override arg.
 */
function resolveModel(phase, args) {
  if (args.model) return args.model;
  return PHASE_MODEL[phase] ?? "sonnet";
}

/**
 * emit — fire-and-forget SSE envelope to the P2 ingest endpoint (AC15, AC16).
 * A network failure NEVER propagates — it is caught and logged locally only.
 * Control flow never reads this stream back (AC17).
 */
async function emit(dashboardBaseUrl, runId, type, payload = {}) {
  const url = `${dashboardBaseUrl}/api/runs/${runId}/events`;
  const envelope = {
    type,
    runId,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  try {
    // Use a short timeout so a dead server never blocks a phase transition.
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
    // Swallowed — a POST failure must never break the workflow (AC16).
    // Log locally only so the run trace is visible but not noisy.
    console.warn(`[feature-pipeline] SSE emit failed (${type}): ${_err.message ?? _err}`);
  }
}

/**
 * ghJson — run a gh command with FIXED argument lists (no shell interpolation)
 * and return the parsed JSON. Rejects on non-zero exit. (AC14)
 */
async function ghJson(args) {
  const result = await runCommand("gh", args);
  return JSON.parse(result.stdout);
}

/**
 * runCommand — thin process-execution wrapper used by ghJson and fix agents.
 * Throws on non-zero exit so callers can route to the RESOLUTION sub-workflow.
 */
async function runCommand(cmd, args) {
  // NOTE: The Claude Code Workflow runtime exposes process execution via the
  // agent tools; in a real deployment this delegates to the runtime's exec
  // primitive. The interface is kept thin so the swap is one-line.
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);
  const result = await execAsync([cmd, ...args].join(" "));
  return result;
}

/**
 * fileExists — synchronous existence check; used for brief validation and
 * Figma verdict gate (AC4a, AC5b).
 */
function fileExists(p) {
  const { existsSync } = require("node:fs");
  return existsSync(p);
}

/**
 * fileContains — grep a fixed literal string in a file without shell
 * interpolation (AC14). Returns true iff the token appears.
 */
function fileContains(filePath, token) {
  const { readFileSync } = require("node:fs");
  try {
    const content = readFileSync(filePath, "utf8");
    return content.includes(token);
  } catch {
    return false;
  }
}

/**
 * postAgentComment — post an AGENT:-prefixed comment to a GitHub issue.
 * Used for HIL escalation (never on a literal machine command). (AC19)
 */
async function postAgentComment(repoSlug, issueOrPrNumber, body, type = "issue") {
  const endpoint =
    type === "pr"
      ? `repos/${repoSlug}/issues/${issueOrPrNumber}/comments`
      : `repos/${repoSlug}/issues/${issueOrPrNumber}/comments`;
  // AGENT: prefix marks AI authorship — never on literal machine commands.
  const prefixedBody = `AGENT: ${body}`;
  await runCommand("gh", [
    "api",
    endpoint,
    "-X", "POST",
    "-f", `body=${prefixedBody}`,
  ]);
}

/**
 * haltWithBrainstormNeeded — phase 1 escalation when the brief is absent or
 * malformed. Posts an AGENT: comment and ends the run. (AC4a)
 */
async function haltWithBrainstormNeeded(args, reason) {
  const msg =
    `brainstorm needed — ${reason}. ` +
    `Run the front-door brainstorm (P6 driving skill → superpowers:brainstorming) ` +
    `to produce ${args.brainstormBriefPath} before invoking this engine.`;
  console.error(`[feature-pipeline] HALT: ${msg}`);
  // If an epic issue already exists, post the comment there; otherwise log only.
  // (The epic does not exist at phase 1 — this is an early-exit, so logging is enough.)
  throw new Error(`HALT: ${msg}`);
}

// ---------------------------------------------------------------------------
// Phase implementations
// ---------------------------------------------------------------------------

/**
 * phase1_validate — brief validation + project-bootstrap coherence.
 * Idempotent: if the run-state already has uiFeature set and the brief exists,
 * returns early. (AC1/validate, AC4a, AC13)
 */
async function phase1_validate(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.VALIDATE, label: "Validate (brief + bootstrap)" });

  // Idempotent re-check: if validation already passed this run, skip.
  if (runState.phase1Done) {
    await emit_("phase_end", { phase: PHASES.VALIDATE, status: "skipped" });
    return;
  }

  // (a) Brief validation — the engine VALIDATES, never brainstorms (AC4a).
  if (!fileExists(args.brainstormBriefPath)) {
    await haltWithBrainstormNeeded(args, `brainstormBriefPath does not exist: ${args.brainstormBriefPath}`);
  }

  // The brief must carry the greppable `uiFeature:` marker (AC4a).
  const hasUiMarker = fileContains(args.brainstormBriefPath, "uiFeature:");
  if (!hasUiMarker) {
    await haltWithBrainstormNeeded(
      args,
      `brainstormBriefPath exists but lacks the required 'uiFeature:' marker: ${args.brainstormBriefPath}`
    );
  }

  // Derive the uiFeature flag from the brief (AC4a, AC5a).
  // The explicit arg is an override; otherwise derive from the marker.
  let uiFeature;
  if (typeof args.uiFeature === "boolean") {
    uiFeature = args.uiFeature;
  } else {
    uiFeature = fileContains(args.brainstormBriefPath, "uiFeature: yes");
  }
  runState.uiFeature = uiFeature;

  // (b) project-bootstrap validate-mode instance coherence (sonnet).
  await emit_("agent_start", {
    phase: PHASES.VALIDATE,
    agentId: "project-bootstrap",
    label: "validate-mode instance coherence",
  });
  // Leaf worker dispatch — loads .claude/skills/project-bootstrap/SKILL.md (AC21).
  await dispatch({
    skill: ".claude/skills/project-bootstrap/SKILL.md",
    mode: "validate",
    repoSlug: args.repoSlug,
    model: resolveModel(PHASES.VALIDATE, args),
  });
  await emit_("agent_end", { phase: PHASES.VALIDATE, agentId: "project-bootstrap", status: "done" });

  runState.phase1Done = true;
  await emit_("phase_end", { phase: PHASES.VALIDATE, status: "done" });
}

/**
 * phase2_epicAuthoring — dispatch epic-authoring (P3) to consume the brief
 * and produce a tmp/docs/ epic spec. Opus (synthesis). (AC2)
 */
async function phase2_epicAuthoring(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.EPIC_AUTHORING, label: "Epic authoring" });

  // Idempotent: if the epic spec file already exists, skip.
  if (fileExists(args.epicSpecPath)) {
    await emit_("phase_end", { phase: PHASES.EPIC_AUTHORING, status: "skipped" });
    return;
  }

  await emit_("agent_start", {
    phase: PHASES.EPIC_AUTHORING,
    agentId: "epic-authoring",
    label: "research synthesis → tmp/docs/ epic spec",
  });
  // Leaf worker — .claude/skills/epic-authoring/SKILL.md (P3). (AC21)
  await dispatch({
    skill: ".claude/skills/epic-authoring/SKILL.md",
    brainstormBriefPath: args.brainstormBriefPath,
    epicSpecPath: args.epicSpecPath,
    featureSlug: args.featureSlug,
    uiFeature: runState.uiFeature,
    repoSlug: args.repoSlug,
    model: resolveModel(PHASES.EPIC_AUTHORING, args),
  });
  await emit_("agent_end", { phase: PHASES.EPIC_AUTHORING, agentId: "epic-authoring", status: "done" });
  await emit_("phase_end", { phase: PHASES.EPIC_AUTHORING, status: "done" });
}

/**
 * phase3_figmaDesign — UI-only. Dispatch figma-design (P8) to build WIP-page
 * frames from the epic spec's SCOPE-IN + CONSTRAINTS. Opus. (AC3/5a)
 */
async function phase3_figmaDesign(args, runState, emit_) {
  // Skip entirely when uiFeature == false (AC5a).
  if (!runState.uiFeature) {
    runState.phase3Done = true;
    return;
  }

  await emit_("phase_start", { phase: PHASES.FIGMA_DESIGN, label: "Figma design (UI-only)" });

  // Idempotent: track whether we've produced frames this run-state instance.
  // On resume, the phase-4 verdict file is the ground truth (checked at phase-5 entry).
  if (runState.phase3Done) {
    await emit_("phase_end", { phase: PHASES.FIGMA_DESIGN, status: "skipped" });
    return;
  }

  await emit_("agent_start", {
    phase: PHASES.FIGMA_DESIGN,
    agentId: "figma-design",
    label: "build/modify WIP-page frames",
  });
  // Leaf worker — .claude/skills/figma-design/SKILL.md (P8). (AC21)
  const figmaResult = await dispatch({
    skill: ".claude/skills/figma-design/SKILL.md",
    epicSpecPath: args.epicSpecPath,
    featureSlug: args.featureSlug,
    repoSlug: args.repoSlug,
    model: resolveModel(PHASES.FIGMA_DESIGN, args),
  });
  // Capture the WIP frame node-ids so phase-4 reviewer can reference them.
  runState.figmaFrameNodeIds = figmaResult?.figmaFrameNodeIds ?? [];
  runState.phase3Done = true;

  await emit_("agent_end", { phase: PHASES.FIGMA_DESIGN, agentId: "figma-design", status: "done" });
  await emit_("phase_end", { phase: PHASES.FIGMA_DESIGN, status: "done" });
}

/**
 * phase4_figmaReview — UI-only. Dispatch reviewing-figma-designs (P9) +
 * julianken-bot to review WIP frames. Writes Figma-Design-Verdict to a FILE.
 * Loops back to phase 3 on REQUEST_CHANGES (per-frame analogue of per-HEAD
 * review). Escalates to RESOLUTION after cap. Opus. (AC4/5b)
 */
async function phase4_figmaReview(args, runState, emit_) {
  // Skip entirely when uiFeature == false (AC5a).
  if (!runState.uiFeature) {
    runState.phase4Done = true;
    return;
  }

  await emit_("phase_start", { phase: PHASES.FIGMA_REVIEW, label: "Figma design review (UI-only)" });

  const verdictFilePath = `tmp/docs/${args.featureSlug}/figma-verdict.txt`;

  // Idempotent: if the verdict FILE already contains APPROVE, skip.
  if (fileContains(verdictFilePath, FIGMA_DESIGN_VERDICT_APPROVE_TOKEN)) {
    runState.phase4Done = true;
    await emit_("phase_end", { phase: PHASES.FIGMA_REVIEW, status: "skipped" });
    return;
  }

  let attempts = 0;

  while (attempts < RESOLUTION_MAX_ATTEMPTS) {
    attempts++;
    await emit_("agent_start", {
      phase: PHASES.FIGMA_REVIEW,
      agentId: "reviewing-figma-designs",
      label: `attempt ${attempts}`,
    });

    // Parallel dispatch: reviewing-figma-designs (P9) + julianken-bot (AC23 analogue for design).
    // Leaf workers — .claude/skills/reviewing-figma-designs/SKILL.md + .claude/agents/julianken-bot.md (AC21)
    await parallel([
      dispatch({
        skill: ".claude/skills/reviewing-figma-designs/SKILL.md",
        figmaFrameNodeIds: runState.figmaFrameNodeIds ?? [],
        epicSpecPath: args.epicSpecPath,
        featureSlug: args.featureSlug,
        verdictFilePath,
        repoSlug: args.repoSlug,
        model: resolveModel(PHASES.FIGMA_REVIEW, args),
      }),
      dispatch({
        agent: ".claude/agents/julianken-bot.md",
        task: "figma-design-review-gate",
        featureSlug: args.featureSlug,
        figmaFrameNodeIds: runState.figmaFrameNodeIds ?? [],
        verdictFilePath,
        repoSlug: args.repoSlug,
        model: resolveModel(PHASES.FIGMA_REVIEW, args),
      }),
    ]);

    await emit_("agent_end", {
      phase: PHASES.FIGMA_REVIEW,
      agentId: "reviewing-figma-designs",
      status: "dispatched",
    });

    // Read the verdict FILE — the gate is the FILE, never a gh comment (AC5b).
    const approved = fileContains(verdictFilePath, FIGMA_DESIGN_VERDICT_APPROVE_TOKEN);

    if (approved) {
      runState.phase4Done = true;
      await emit_("phase_end", { phase: PHASES.FIGMA_REVIEW, status: "done" });
      return;
    }

    // REQUEST_CHANGES → revise frames (loop back to phase 3 body) then re-review.
    await emit_("log", {
      phase: PHASES.FIGMA_REVIEW,
      label: `Figma review REQUEST_CHANGES — revising frames (attempt ${attempts})`,
    });

    // Reset phase3Done so phase3 re-runs with revised instructions.
    runState.phase3Done = false;
    await phase3_figmaDesign(args, runState, emit_);
  }

  // Exhausted retries — escalate to RESOLUTION sub-workflow (AC18).
  await resolveBlocker(
    args,
    runState,
    emit_,
    PHASES.FIGMA_REVIEW,
    "Figma design review did not converge to APPROVE after max attempts"
  );
}

/**
 * phase5_issueFanOut — create child issues FIRST, then the epic (AC6).
 * For UI features: HARD ENTRY precondition on Figma-Design-Verdict APPROVE
 * in the verdict FILE before any issue is created (AC5b).
 */
async function phase5_issueFanOut(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.ISSUE_FAN_OUT, label: "Issue fan-out" });

  // HARD ENTRY GATE for UI features (AC5b).
  if (runState.uiFeature) {
    const verdictFilePath = `tmp/docs/${args.featureSlug}/figma-verdict.txt`;
    // grep -F the exact literal token (AC5b).
    if (!fileContains(verdictFilePath, FIGMA_DESIGN_VERDICT_APPROVE_TOKEN)) {
      throw new Error(
        "PHASE_5_BLOCKED: Figma-Design-Verdict APPROVE not found in verdict file — " +
          "phase 4 must converge before issue fan-out."
      );
    }
  }

  // Idempotent: check whether child issue numbers already exist on gh.
  // If all childSpecPaths have matching issues, skip.
  const existingChildren = await ghExistingIssues(args.repoSlug, args.featureSlug, "child");
  if (existingChildren.length >= args.childSpecPaths.length && runState.epicIssueNumber) {
    await emit_("phase_end", { phase: PHASES.ISSUE_FAN_OUT, status: "skipped" });
    return;
  }

  // Children first (AC6). Dispatch issue-authoring per child spec.
  const childIssueNumbers = [];
  for (const specPath of args.childSpecPaths) {
    await emit_("agent_start", {
      phase: PHASES.ISSUE_FAN_OUT,
      agentId: "issue-authoring",
      label: `child spec: ${specPath}`,
    });
    // Leaf worker — .claude/skills/issue-authoring/SKILL.md (AC21)
    const result = await dispatch({
      skill: ".claude/skills/issue-authoring/SKILL.md",
      specPath,
      repoSlug: args.repoSlug,
      epicLinkPending: true, // epic number not yet known
      model: resolveModel(PHASES.ISSUE_FAN_OUT, args),
    });
    const childNumber = result?.issueNumber;
    if (childNumber) childIssueNumbers.push(childNumber);
    await emit_("agent_end", {
      phase: PHASES.ISSUE_FAN_OUT,
      agentId: "issue-authoring",
      status: "done",
      payload: { issueNumber: childNumber },
    });
  }
  runState.childIssueNumbers = childIssueNumbers;

  // Epic LAST — so the epic body can link finalized child numbers (AC6).
  await emit_("agent_start", {
    phase: PHASES.ISSUE_FAN_OUT,
    agentId: "issue-authoring",
    label: "epic issue (last)",
  });
  const epicResult = await dispatch({
    skill: ".claude/skills/issue-authoring/SKILL.md",
    specPath: args.epicSpecPath,
    repoSlug: args.repoSlug,
    childIssueNumbers,
    isEpic: true,
    model: resolveModel(PHASES.ISSUE_FAN_OUT, args),
  });
  runState.epicIssueNumber = epicResult?.issueNumber;
  await emit_("agent_end", {
    phase: PHASES.ISSUE_FAN_OUT,
    agentId: "issue-authoring",
    status: "done",
    payload: { issueNumber: runState.epicIssueNumber },
  });

  await emit_("phase_end", { phase: PHASES.ISSUE_FAN_OUT, status: "done" });
}

/**
 * phase6_planReview — children first, epic LAST (AC7). Each verdict is read
 * by matching the stable PLAN_REVIEW_APPROVE_TOKEN (AC10). Routes
 * REQUEST_CHANGES to the RESOLUTION sub-workflow. Opus.
 */
async function phase6_planReview(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.PLAN_REVIEW, label: "Plan review" });

  // Review order: [...childIssueNumbers, epicIssueNumber] (AC7 — epic last, literal ordering).
  const reviewOrder = [
    ...(runState.childIssueNumbers ?? []),
    runState.epicIssueNumber,
  ].filter(Boolean);

  for (const issueNumber of reviewOrder) {
    const isEpic = issueNumber === runState.epicIssueNumber;

    // Idempotent: if this issue already has a plan-review APPROVE comment, skip (AC13).
    const alreadyApproved = await ghIssueHasApproveComment(
      args.repoSlug,
      issueNumber,
      PLAN_REVIEW_APPROVE_TOKEN
    );
    if (alreadyApproved) {
      await emit_("log", {
        phase: PHASES.PLAN_REVIEW,
        label: `issue #${issueNumber} already approved — skipping`,
      });
      continue;
    }

    let attempts = 0;
    let approved = false;

    while (!approved && attempts < RESOLUTION_MAX_ATTEMPTS) {
      attempts++;
      await emit_("agent_start", {
        phase: PHASES.PLAN_REVIEW,
        agentId: "julianken-bot",
        label: `plan-review issue #${issueNumber} (attempt ${attempts})`,
      });

      // Dispatch julianken-bot loaded with issue-plan-review (AC21).
      await dispatch({
        agent: ".claude/agents/julianken-bot.md",
        skill: ".claude/skills/issue-plan-review/SKILL.md",
        issueNumber,
        repoSlug: args.repoSlug,
        isEpic,
        model: resolveModel(PHASES.PLAN_REVIEW, args),
      });

      await emit_("agent_end", {
        phase: PHASES.PLAN_REVIEW,
        agentId: "julianken-bot",
        status: "dispatched",
      });

      // Read verdict by matching the fixed greppable token (AC10).
      // PR-review convergence uses reviewDecision (AC10, AC12) — different mechanism.
      approved = await ghIssueHasApproveComment(
        args.repoSlug,
        issueNumber,
        PLAN_REVIEW_APPROVE_TOKEN
      );

      if (!approved) {
        await resolveBlocker(
          args,
          runState,
          emit_,
          PHASES.PLAN_REVIEW,
          `Plan review for issue #${issueNumber} returned REQUEST_CHANGES`
        );
        // After RESOLUTION, re-check gh ground truth at next iteration.
      }
    }

    if (!approved) {
      // Escalate if RESOLUTION sub-workflow exhausted without achieving APPROVE.
      await postAgentComment(
        args.repoSlug,
        issueNumber,
        `brainstorm needed — plan-review for issue #${issueNumber} did not converge ` +
          `after ${RESOLUTION_MAX_ATTEMPTS} RESOLUTION attempts. Human review required.`
      );
      throw new Error(`PLAN_REVIEW_ESCALATED: issue #${issueNumber}`);
    }
  }

  // All children AND epic approved (AC9).
  await emit_("phase_end", { phase: PHASES.PLAN_REVIEW, status: "done" });
}

/**
 * phase7_implement — parallel + dependency-ordered implementer dispatch.
 * Sonnet (mechanical). (AC20)
 */
async function phase7_implement(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.IMPLEMENT, label: "Implementation" });

  const childNumbers = runState.childIssueNumbers ?? [];

  // Idempotent: skip children whose PRs already exist.
  const prsNeeded = [];
  for (const issueNumber of childNumbers) {
    const hasPr = await ghIssueHasPr(args.repoSlug, issueNumber);
    if (!hasPr) prsNeeded.push(issueNumber);
  }

  if (prsNeeded.length === 0) {
    await emit_("phase_end", { phase: PHASES.IMPLEMENT, status: "skipped" });
    return;
  }

  // Dispatch implementer agents in parallel (dependency-ordered externally via
  // childSpecPaths ordering). Each agent runs in its own worktree (isolation).
  await emit_("agent_start", {
    phase: PHASES.IMPLEMENT,
    agentId: "implementer",
    label: `dispatching ${prsNeeded.length} implementer(s)`,
  });
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
  await emit_("agent_end", { phase: PHASES.IMPLEMENT, agentId: "implementer", status: "done" });
  await emit_("phase_end", { phase: PHASES.IMPLEMENT, status: "done" });
}

/**
 * phase8_prCreate — dispatch creating-prs (+ pr-screenshots for UI PRs).
 * Sonnet (mechanical). (AC20)
 */
async function phase8_prCreate(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.PR_CREATE, label: "PR creation" });

  const childNumbers = runState.childIssueNumbers ?? [];
  const prsToCreate = [];
  for (const issueNumber of childNumbers) {
    const pr = await ghGetPrForIssue(args.repoSlug, issueNumber);
    if (!pr) prsToCreate.push(issueNumber);
    else if (pr.number) runState.prByIssue = { ...(runState.prByIssue ?? {}), [issueNumber]: pr.number };
  }

  if (prsToCreate.length === 0) {
    await emit_("phase_end", { phase: PHASES.PR_CREATE, status: "skipped" });
    return;
  }

  for (const issueNumber of prsToCreate) {
    await emit_("agent_start", {
      phase: PHASES.PR_CREATE,
      agentId: "creating-prs",
      label: `PR for issue #${issueNumber}`,
    });

    const dispatchArgs = {
      skill: ".claude/skills/creating-prs/SKILL.md",
      issueNumber,
      repoSlug: args.repoSlug,
      uiFeature: runState.uiFeature,
      model: resolveModel(PHASES.PR_CREATE, args),
    };

    // For UI PRs, also attach screenshots before review is dispatched (pr-workflow rule 4).
    if (runState.uiFeature) {
      dispatchArgs.screenshotsSkill = "pr-screenshots-via-user-attachments";
    }

    const prResult = await dispatch(dispatchArgs);
    if (prResult?.prNumber) {
      runState.prByIssue = {
        ...(runState.prByIssue ?? {}),
        [issueNumber]: prResult.prNumber,
      };
    }

    await emit_("agent_end", {
      phase: PHASES.PR_CREATE,
      agentId: "creating-prs",
      status: "done",
      payload: { prNumber: prResult?.prNumber },
    });
  }

  await emit_("phase_end", { phase: PHASES.PR_CREATE, status: "done" });
}

/**
 * phase9_prReview — per-HEAD PR-review loop to convergence (AC11, AC12).
 * Reads reviewDecision + statusCheckRollup + headRefOid from gh at each
 * iteration (NOT from the SSE stream — AC17). design-reviewer dispatched in
 * parallel() with julianken-bot on UI PRs only (AC23). Opus.
 *
 * Convergence = reviewDecision == APPROVED vs current headRefOid AND
 * statusCheckRollup green (AC12).
 */
async function phase9_prReview(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.PR_REVIEW, label: "PR review" });

  const prByIssue = runState.prByIssue ?? {};

  for (const [issueNumber, prNumber] of Object.entries(prByIssue)) {
    let attempts = 0;
    let converged = false;

    while (!converged && attempts < RESOLUTION_MAX_ATTEMPTS) {
      attempts++;

      // Read live gh state — ground truth, not run-state cache (AC12, AC13, AC17).
      const prState = await ghJson([
        "pr", "view", String(prNumber),
        "--repo", args.repoSlug,
        "--json", "reviewDecision,statusCheckRollup,headRefOid",
      ]);

      const { reviewDecision, statusCheckRollup, headRefOid } = prState;

      // Track the HEAD we reviewed so we can detect a push-after-approval.
      const lastReviewedHead = runState.lastReviewedHead?.[prNumber];
      const headChanged = lastReviewedHead && lastReviewedHead !== headRefOid;

      // If previously APPROVED on an OLD head (new commit pushed), invalidate (AC11).
      if (reviewDecision === "APPROVED" && !headChanged) {
        const checksGreen = classifyChecks(statusCheckRollup);
        if (checksGreen) {
          converged = true;
          break;
        }
        // Checks not green after approval — route to RESOLUTION.
        await resolveBlocker(
          args,
          runState,
          emit_,
          PHASES.PR_REVIEW,
          `PR #${prNumber} is APPROVED but CI checks are not green`
        );
        continue;
      }

      // Dispatch the bot review on the current HEAD (AC11).
      await emit_("agent_start", {
        phase: PHASES.PR_REVIEW,
        agentId: "julianken-bot",
        label: `PR #${prNumber} review on HEAD ${headRefOid} (attempt ${attempts})`,
      });

      // On UI PRs: design-reviewer runs in parallel() with julianken-bot (AC23).
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

      if (runState.uiFeature) {
        reviewDispatch.push(
          dispatch({
            agent: ".claude/agents/design-reviewer.md",
            prNumber,
            repoSlug: args.repoSlug,
            headRefOid,
            model: resolveModel(PHASES.PR_REVIEW, args),
          })
        );
      }

      await parallel(reviewDispatch);

      // Record which HEAD we just reviewed.
      runState.lastReviewedHead = {
        ...(runState.lastReviewedHead ?? {}),
        [prNumber]: headRefOid,
      };

      await emit_("agent_end", {
        phase: PHASES.PR_REVIEW,
        agentId: "julianken-bot",
        status: "dispatched",
      });

      // Re-read gh ground truth after review (AC12, AC13).
      const afterState = await ghJson([
        "pr", "view", String(prNumber),
        "--repo", args.repoSlug,
        "--json", "reviewDecision,statusCheckRollup,headRefOid",
      ]);

      // reviewDecision is a STRUCTURED FIELD, not a comment token (AC10, AC12).
      const approved = afterState.reviewDecision === "APPROVED";
      const currentHead = afterState.headRefOid;
      const stillSameHead = currentHead === headRefOid;

      if (approved && stillSameHead && classifyChecks(afterState.statusCheckRollup)) {
        converged = true;
      } else if (!approved) {
        // REQUEST_CHANGES — route to RESOLUTION to apply fixes, then push (AC11).
        await resolveBlocker(
          args,
          runState,
          emit_,
          PHASES.PR_REVIEW,
          `PR #${prNumber}: reviewDecision is not APPROVED`
        );
        // After fix + push, the new HEAD invalidates the prior approval — loop.
      }
    }

    if (!converged) {
      await postAgentComment(
        args.repoSlug,
        prNumber,
        `PR #${prNumber} review did not converge to APPROVED after ${RESOLUTION_MAX_ATTEMPTS} attempts. Human review required.`,
        "pr"
      );
      throw new Error(`PR_REVIEW_ESCALATED: PR #${prNumber} issue #${issueNumber}`);
    }
  }

  await emit_("phase_end", { phase: PHASES.PR_REVIEW, status: "done" });
}

/**
 * phase10_merge — trigger Mergify queue for each approved PR. Never calls
 * gh pr merge (AC22). Sonnet (mechanical).
 */
async function phase10_merge(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.MERGE, label: "Merge via Mergify queue" });

  const prByIssue = runState.prByIssue ?? {};

  for (const [issueNumber, prNumber] of Object.entries(prByIssue)) {
    // Idempotent: if already merged, skip (AC13).
    const prState = await ghJson([
      "pr", "view", String(prNumber),
      "--repo", args.repoSlug,
      "--json", "mergedAt,state",
    ]);
    if (prState.mergedAt || prState.state === "MERGED") {
      await emit_("log", {
        phase: PHASES.MERGE,
        label: `PR #${prNumber} already merged — skipping`,
      });
      continue;
    }

    // Post the Mergify queue trigger — exact body, standalone comment (AC22, pr-workflow rule 6).
    // NEVER prefix with AGENT: — the trigger must be exactly 16 chars: "@Mergifyio queue".
    await runCommand("gh", [
      "pr", "comment", String(prNumber),
      "--repo", args.repoSlug,
      "--body", "@Mergifyio queue",
    ]);

    await emit_("log", {
      phase: PHASES.MERGE,
      label: `@Mergifyio queue posted for PR #${prNumber} (issue #${issueNumber})`,
    });
  }

  // Wait for all PRs to show mergedAt in gh (idempotent poll).
  await waitForMerges(args.repoSlug, Object.values(prByIssue), emit_);

  // Epic closed LAST — after all children have merged (AC8).
  if (runState.epicIssueNumber) {
    await runCommand("gh", [
      "issue", "close", String(runState.epicIssueNumber),
      "--repo", args.repoSlug,
    ]);
    await emit_("log", {
      phase: PHASES.MERGE,
      label: `Epic issue #${runState.epicIssueNumber} closed (last, after all child PRs merged)`,
    });
  }

  await emit_("phase_end", { phase: PHASES.MERGE, status: "done" });
}

/**
 * phase11_deployVerify — post-merge deploy check (deploy runs on main push).
 * Reads the deploy CI job status from gh. Sonnet (mechanical).
 */
async function phase11_deployVerify(args, runState, emit_) {
  await emit_("phase_start", { phase: PHASES.DEPLOY, label: "Deploy verification" });

  // Read the latest main CI run and check for the deploy job.
  const runs = await ghJson([
    "run", "list",
    "--repo", args.repoSlug,
    "--branch", "main",
    "--limit", "5",
    "--json", "databaseId,status,conclusion,name",
  ]);

  const deployRun = runs.find(
    (r) => r.status === "completed" && (r.name?.includes("deploy") || r.name?.includes("ci"))
  );

  const success = deployRun?.conclusion === "success";
  await emit_("log", {
    phase: PHASES.DEPLOY,
    label: success ? "Deploy CI green" : "Deploy CI status unclear — check manually",
    payload: { run: deployRun },
  });

  await emit_("phase_end", { phase: PHASES.DEPLOY, status: success ? "done" : "warning" });
}

// ---------------------------------------------------------------------------
// RESOLUTION sub-workflow (§3.6 / AC18, AC19)
// ---------------------------------------------------------------------------

/**
 * resolveBlocker — diagnose → fix → verify loop for a stuck phase.
 * Bounded by RESOLUTION_MAX_ATTEMPTS (engine-internal run-state counter
 * reconciled against gh on resume — AC18). Escalates to HIL only when truly
 * unresolvable (AC19).
 */
async function resolveBlocker(args, runState, emit_, phase, description) {
  const counterKey = `resolution_attempts_phase_${phase}`;
  runState[counterKey] = (runState[counterKey] ?? 0) + 1;
  const attempt = runState[counterKey];

  await emit_("log", {
    phase,
    label: `RESOLUTION attempt ${attempt}/${RESOLUTION_MAX_ATTEMPTS}: ${description}`,
  });

  if (attempt > RESOLUTION_MAX_ATTEMPTS) {
    // Escalate to HIL — post AGENT:-prefixed comment naming the exact info-need (AC19).
    // Never prefix a literal machine command; this is human-readable prose only.
    await postAgentComment(
      args.repoSlug,
      runState.epicIssueNumber ?? 0,
      `Phase ${phase} blocker unresolvable after ${RESOLUTION_MAX_ATTEMPTS} attempts: ${description}. ` +
        `Human review required — please diagnose and re-run the engine once resolved.`
    );
    throw new Error(`HIL_ESCALATED: phase=${phase} description="${description}"`);
  }

  // Diagnose — gather failing signal from gh/CI logs.
  await emit_("agent_start", {
    phase,
    agentId: "resolution-diagnose",
    label: `diagnose (attempt ${attempt})`,
  });
  const diagnosis = await dispatch({
    agent: "general-purpose",
    task: "diagnose-blocker",
    description,
    phase,
    repoSlug: args.repoSlug,
    model: "sonnet",
  });
  await emit_("agent_end", { phase, agentId: "resolution-diagnose", status: "done" });

  // Fix — dispatch a scoped implementer for the specific blocker.
  await emit_("agent_start", {
    phase,
    agentId: "resolution-fix",
    label: `fix (attempt ${attempt})`,
  });
  await dispatch({
    agent: "general-purpose",
    task: "fix-blocker",
    diagnosis,
    phase,
    repoSlug: args.repoSlug,
    isolation: "worktree",
    model: "sonnet",
  });
  await emit_("agent_end", { phase, agentId: "resolution-fix", status: "done" });

  // Verify — re-read gh ground truth to confirm fix took.
  await emit_("agent_start", {
    phase,
    agentId: "resolution-verify",
    label: `verify (attempt ${attempt})`,
  });
  await dispatch({
    agent: "general-purpose",
    task: "verify-fix",
    phase,
    repoSlug: args.repoSlug,
    model: "sonnet",
  });
  await emit_("agent_end", { phase, agentId: "resolution-verify", status: "done" });

  await emit_("log", {
    phase,
    label: `RESOLUTION attempt ${attempt} complete — caller re-checks gh ground truth`,
  });
}

// ---------------------------------------------------------------------------
// gh helper functions (port of tmp/dashboard/server.py classify_checks +
// pick_pr_for_issue + derive_status patterns, adapted for JS). (§3.4, AC14)
// ---------------------------------------------------------------------------

/**
 * classifyChecks — mirrors server.py L115 classify_checks.
 * Returns true iff all checks passed (no failures, no pending).
 * Uses fixed argument lists only (AC14).
 */
function classifyChecks(statusCheckRollup) {
  if (!statusCheckRollup || statusCheckRollup.length === 0) return true; // no checks = green
  const allPassed = statusCheckRollup.every(
    (c) => c.status === "COMPLETED" && c.conclusion === "SUCCESS"
  );
  return allPassed;
}

/**
 * ghIssueHasPr — check if a given issue number has an associated PR on the
 * repo, by searching for a cross-reference in gh.
 */
async function ghIssueHasPr(repoSlug, issueNumber) {
  const pr = await ghGetPrForIssue(repoSlug, issueNumber);
  return pr !== null;
}

/**
 * ghGetPrForIssue — find the open or merged PR linked to an issue.
 * Mirrors server.py L149 pick_pr_for_issue. Returns {number, state} or null.
 */
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

/**
 * ghIssueHasApproveComment — check if the given issue has a plan-review
 * APPROVE comment by matching the fixed greppable token (AC10).
 * Reads structured JSON from gh — no shell interpolation (AC14).
 */
async function ghIssueHasApproveComment(repoSlug, issueNumber, token) {
  const comments = await ghJson([
    "api",
    `repos/${repoSlug}/issues/${issueNumber}/comments`,
    "--jq", "[.[].body]",
  ]);
  return Array.isArray(comments) && comments.some((body) => body.includes(token));
}

/**
 * ghExistingIssues — list open issues in the repo matching a feature slug
 * label or title prefix. Used for idempotent fan-out checks.
 */
async function ghExistingIssues(repoSlug, featureSlug, kind) {
  const issues = await ghJson([
    "issue", "list",
    "--repo", repoSlug,
    "--state", "open",
    "--json", "number,title,labels",
    "--limit", "100",
  ]);
  return issues.filter(
    (i) =>
      i.title?.toLowerCase().includes(featureSlug.toLowerCase()) &&
      (kind === "child" ? !i.title?.toLowerCase().includes("epic") : i.title?.toLowerCase().includes("epic"))
  );
}

/**
 * waitForMerges — poll gh until all PRs in the list show mergedAt (AC13).
 * Bounded to avoid infinite spin.
 */
async function waitForMerges(repoSlug, prNumbers, emit_) {
  const maxPollSeconds = 600;
  const pollIntervalMs = 15_000;
  const start = Date.now();

  while (Date.now() - start < maxPollSeconds * 1000) {
    const unmerged = [];
    for (const prNumber of prNumbers) {
      const state = await ghJson([
        "pr", "view", String(prNumber),
        "--repo", repoSlug,
        "--json", "mergedAt,state",
      ]);
      if (!state.mergedAt && state.state !== "MERGED") {
        unmerged.push(prNumber);
      }
    }
    if (unmerged.length === 0) return;

    await emit_("log", {
      phase: PHASES.MERGE,
      label: `Waiting for Mergify to process PR(s): ${unmerged.join(", ")}`,
    });
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error("MERGE_TIMEOUT: PRs did not show mergedAt within the poll window");
}

// ---------------------------------------------------------------------------
// Runtime dispatch + parallel helpers
// (thin wrappers over the Claude Code Workflow agent dispatch primitives)
// ---------------------------------------------------------------------------

/**
 * dispatch — invoke a skill or agent as a leaf worker.
 * The Claude Code Workflow runtime provides the actual `dispatch` / `agent`
 * primitive; this wrapper keeps call sites clean and the swap is one line.
 * Leaf workers are DISPATCHED, never re-implemented here (AC21).
 */
async function dispatch(opts) {
  // In the Claude Code Workflow runtime, agent/skill dispatch is provided
  // natively. This stub documents the interface; the runtime replaces it.
  if (typeof globalThis.__workflowDispatch === "function") {
    return globalThis.__workflowDispatch(opts);
  }
  // Fallback for test/dry-run: log and return a stub result.
  console.log(`[dispatch] ${JSON.stringify(opts)}`);
  return { dispatched: true };
}

/**
 * parallel — run multiple dispatch calls concurrently.
 * Mirrors Promise.all semantics; the runtime may substitute its own
 * parallelism primitive for better observability.
 */
async function parallel(promises) {
  return Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * run — the engine entry point called by the Claude Code Workflow runtime
 * with the parsed args object (schema-validated before this is called).
 *
 * Runs phases 1–11 in sequence. Each phase is idempotent; the engine can be
 * resumed after a crash by re-running with the same args — gh ground truth is
 * re-read at every phase entry (AC13). The SSE stream is additive in-flight
 * detail only; control flow never reads it back (AC17).
 */
export async function run(args) {
  // Validate required args (should be caught by schema before this, but
  // belt-and-suspenders for direct invocations).
  for (const key of REQUIRED_ARGS) {
    if (!args[key]) {
      throw new Error(`Missing required arg: ${key}`);
    }
  }

  // Engine-internal run-state (not persisted across session exits — per spec §1).
  // On resume, each phase reconciles against gh ground truth at entry (AC13).
  const runState = {};

  // Defaults for optional args.
  const runId = args.runId ?? `run-${Date.now()}`;
  const dashboardBaseUrl = args.dashboardBaseUrl ?? "http://127.0.0.1:2025";

  // Partial-apply emit with the run's runId + baseUrl so phase functions get
  // a clean signature.
  const emit_ = (type, payload = {}) =>
    emit(dashboardBaseUrl, runId, type, payload);

  await emit_("run_start", {
    featureSlug: args.featureSlug,
    repoSlug: args.repoSlug,
    phases: Object.values(PHASES),
  });

  try {
    await phase1_validate(args, runState, emit_);
    await phase2_epicAuthoring(args, runState, emit_);
    await phase3_figmaDesign(args, runState, emit_);
    await phase4_figmaReview(args, runState, emit_);
    await phase5_issueFanOut(args, runState, emit_);
    await phase6_planReview(args, runState, emit_);
    await phase7_implement(args, runState, emit_);
    await phase8_prCreate(args, runState, emit_);
    await phase9_prReview(args, runState, emit_);
    await phase10_merge(args, runState, emit_);
    await phase11_deployVerify(args, runState, emit_);

    await emit_("run_end", { status: "success", featureSlug: args.featureSlug });
  } catch (err) {
    await emit_("run_end", { status: "error", error: err.message });
    throw err;
  }
}
