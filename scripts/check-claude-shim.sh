#!/usr/bin/env bash
# Verify CLAUDE.md is still a thin Claude-only shim that imports AGENTS.md.
#
# AGENTS.md is the single source of truth; CLAUDE.md must stay tiny and only
# import it (plus one "## Claude Code only" tail). This guard catches the five
# real drift modes:
#   1. CLAUDE.md turned into a symlink (breaks on Windows / core.symlinks=false).
#   2. the bare `@AGENTS.md` import line dropped (severs Claude from the SoT).
#   3. the import fenced in a code block — Claude does not honor a fenced import,
#      so the shim is forbidden any code fence at all (it legitimately has none).
#   4. universal guidance under any ATX heading (H2+) other than the lone allowed
#      '## Claude Code only' (whitelist, not blacklist; setext-underline headings
#      aren't matched here but are bounded by the size ceiling).
#   5. heading-less prose dumped in (caught by the line-count ceiling).
#
# Run from anywhere inside the repo. Exit 0 = intact, exit 1 = drift detected.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
f="$root/CLAUDE.md"
max_lines=25
fail=0

if [ ! -f "$f" ]; then
  echo "FAIL: $f not found"
  exit 1
fi

# 1. Must be a real tracked file, not a symlink.
if [ -L "$f" ]; then
  echo "FAIL: CLAUDE.md is a symlink — it must be a plain tracked file."
  fail=1
fi

# 2. The import line must be present on its own line. Whitespace-tolerant,
#    dot escaped so e.g. @AGENTSXmd does not false-positive.
if ! grep -qE '^[[:space:]]*@AGENTS\.md[[:space:]]*$' "$f"; then
  echo "FAIL: missing bare '@AGENTS.md' import line (dropped?)."
  fail=1
fi

# 3. No code fences. A fenced @AGENTS.md would satisfy check 2 yet NOT be honored
#    by Claude Code — a silent severance. The shim has no fenced blocks, so forbid
#    them outright to close that gap.
if grep -qE '^[[:space:]]*```' "$f"; then
  echo "FAIL: code fence in CLAUDE.md — the shim must contain no fenced blocks (a fenced @AGENTS.md import is not honored by Claude Code)."
  fail=1
fi

# 4. Whitelist the single legal heading. Any ATX heading at H2 or deeper other
#    than '## Claude Code only' means universal guidance leaked back in (robust to
#    wording — '## Security', '### Notes', etc. all fail). Setext-underline
#    headings aren't matched here but are bounded by the size ceiling (check 5).
stray="$(grep -E '^#{2,} ' "$f" | grep -vx '## Claude Code only' || true)"
if [ -n "$stray" ]; then
  echo "FAIL: unexpected heading(s) in the shim — universal guidance belongs in AGENTS.md:"
  printf '  %s\n' "$stray"
  fail=1
fi

# 5. Size ceiling catches heading-less prose dumps the H2 whitelist would miss.
lines="$(wc -l < "$f" | tr -d ' ')"
if [ "$lines" -gt "$max_lines" ]; then
  echo "FAIL: CLAUDE.md is $lines lines (>$max_lines). The shim must stay tiny — move content to AGENTS.md."
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "OK: CLAUDE.md is an intact Claude-only shim importing AGENTS.md."
else
  exit 1
fi
