#!/usr/bin/env bash
# Sync docs/plans/issues/*.md bodies to GitHub issues #15–#23.
set -euo pipefail
REPO=julianken/violin-tools
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ISSUES_DIR="$ROOT/docs/plans/issues"

sync() {
  local n="$1" file="$2"
  echo "Updating issue #$n from $file"
  gh issue edit "$n" --repo "$REPO" --body-file "$ISSUES_DIR/$file"
}

sync 15 15-instance-split.md
sync 16 16-repo-local-skills.md
sync 17 17-bootstrap-start-here.md
sync 18 18-status-anti-invention.md
sync 19 19-docs-optional.md
sync 20 20-multi-tool-adapters.md
sync 21 21-validate-scaffolding-ci.md
sync 22 22-pr-template-honest-na.md
sync 23 23-battle-test-scaffolding-pr.md

echo "Done."
