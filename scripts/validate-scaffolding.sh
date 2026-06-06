#!/usr/bin/env bash
# Validate the repo's committed *scaffolding* invariants — the process/config
# skeleton an agent relies on, not the (still absent) app.
#
# This is deliberately NOT app lint/test/build: the repo is pre-code (no
# package.json, no source). It checks only what exists today — that the
# single-source-of-truth shim is intact, the required process/skill/adapter
# files are present and non-empty, and no template placeholder leaked into a
# core process file. It must keep passing with zero app source in the tree.
#
# Run from anywhere inside the repo. Exit 0 = scaffolding intact,
# exit 1 = a problem was found (every failure is printed before exiting).
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
fail=0

fail() { echo "FAIL: $*"; fail=1; }
ok()   { echo "ok:   $*"; }

# --- 1. The CLAUDE.md shim is intact -----------------------------------------
# Reuse the dedicated guard rather than re-encoding its five invariants here
# (single source of truth: scripts/check-claude-shim.sh).
if bash "$root/scripts/check-claude-shim.sh" >/dev/null 2>&1; then
  ok "check-claude-shim.sh passes (CLAUDE.md is an intact @AGENTS.md shim)"
else
  fail "check-claude-shim.sh failed — run it directly to see why"
fi

# --- 2. Required scaffolding paths exist -------------------------------------
# These are the load-bearing process files a cold-start agent reads. Every
# entry here exists on main today; a missing one means scaffolding regressed.
required_paths=(
  "AGENTS.md"
  "CLAUDE.md"
  "INSTANCE.md"
  "DESIGN.md"
  "README.md"
  "SECURITY.md"
  "GAPS.md"
  "START_HERE.md"
  ".github/PULL_REQUEST_TEMPLATE.md"
  ".github/CODEOWNERS"
  ".mergify.yml"
  "scripts/check-claude-shim.sh"
  ".claude/skills/pr-workflow/SKILL.md"
  ".claude/skills/creating-prs/SKILL.md"
  ".claude/skills/reviewing/SKILL.md"
  ".claude/skills/issue-authoring/SKILL.md"
  ".claude/skills/issue-plan-review/SKILL.md"
  ".claude/skills/project-bootstrap/SKILL.md"
)
for p in "${required_paths[@]}"; do
  if [ -e "$p" ]; then
    ok "present: $p"
  else
    fail "missing required scaffolding path: $p"
  fi
done

# --- 3. Multi-tool adapter pointer files are present AND non-empty -----------
# The adapters (issue #20) are pointer-only files; an empty pointer is worse
# than none (it looks wired but says nothing). Treat empty as a failure.
adapter_paths=(
  "GEMINI.md"
  ".github/copilot-instructions.md"
  ".cursor/rules/review-dispatch.mdc"
)
for p in "${adapter_paths[@]}"; do
  if [ ! -e "$p" ]; then
    fail "missing adapter pointer file: $p"
  elif [ ! -s "$p" ]; then
    fail "adapter pointer file is empty: $p"
  else
    ok "non-empty adapter: $p"
  fi
done

# --- 4. No leaked template placeholder in core process files -----------------
# A literal TODO(template) marks a slot meant to be filled before templatizing;
# none should survive in a committed core process file.
placeholder='TODO(template)'
placeholder_scan=(
  "AGENTS.md"
  "CLAUDE.md"
  "INSTANCE.md"
  "README.md"
  "SECURITY.md"
  "GAPS.md"
  "START_HERE.md"
)
for p in "${placeholder_scan[@]}"; do
  [ -e "$p" ] || continue  # absence is caught by section 2; don't double-report
  if grep -qF "$placeholder" "$p"; then
    fail "leaked placeholder '$placeholder' in $p"
  fi
done
# This script names the placeholder string itself; exclude it from the scan
# above (it is not in placeholder_scan) so the validator never flags its own body.
ok "no leaked '$placeholder' in core process files"

# --- Result ------------------------------------------------------------------
if [ "$fail" -eq 0 ]; then
  echo "PASS: scaffolding invariants hold."
else
  echo "FAILED: fix the items marked FAIL above."
  exit 1
fi
