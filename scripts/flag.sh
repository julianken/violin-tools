#!/usr/bin/env bash
# flag.sh — flip a runtime feature flag in the live GCS website bucket (#176).
#
# The app reads `flags.json` from the bucket root at boot (Cloudflare → bucket,
# served `no-cache` so a flip is visible on the next load without a deploy). This
# script is the one-command flip: it read-modify-writes that single object,
# preserving every other key, and uploads it with the cache + content-type policy
# the runtime path needs.
#
#   flag.sh <name> on        # set <name>=true
#   flag.sh <name> off       # set <name>=false
#   flag.sh <name> status    # print the current value (or "unset")
#
# The bucket is taken from $GCS_WEBSITE_BUCKET, falling back to the repo Actions
# variable (`gh variable get GCS_WEBSITE_BUCKET`). It tolerates a missing object
# (first flip creates it). It NEVER deletes unknown keys — other flags survive.
#
# Why this lives OUTSIDE the deploy / Terraform: the object is RUNTIME-managed,
# deliberately not part of `apps/web/dist` (the deploy excludes it from the prune)
# and not in `infra/` (Terraform manages the bucket, not its mutable contents).
#
# Requires: gcloud (authenticated), and — for the bucket fallback — gh.
set -euo pipefail

usage() {
  echo "usage: flag.sh <name> on|off|status" >&2
  exit 2
}

[ "$#" -eq 2 ] || usage
name="$1"
action="$2"

case "$action" in
  on | off | status) ;;
  *) usage ;;
esac

# A flag name is a bare identifier — guard against an injected path/object name.
case "$name" in
  *[!a-zA-Z0-9_-]*) echo "FAIL: invalid flag name '$name'" >&2; exit 2 ;;
esac

# Resolve the bucket: env var wins; otherwise the repo Actions variable via gh.
bucket="${GCS_WEBSITE_BUCKET:-}"
if [ -z "$bucket" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "FAIL: GCS_WEBSITE_BUCKET unset and gh not installed" >&2
    exit 1
  fi
  bucket="$(gh variable get GCS_WEBSITE_BUCKET)"
fi
if [ -z "$bucket" ]; then
  echo "FAIL: could not resolve GCS_WEBSITE_BUCKET" >&2
  exit 1
fi

object="gs://${bucket}/flags.json"

# Read the current object, tolerating a missing one (first write creates it). A
# `gcloud storage cat` of an absent object errors; we swallow that into an empty
# JSON so the read-modify-write starts from {}.
current="$(gcloud storage cat "$object" 2>/dev/null || true)"
[ -n "$current" ] || current='{}'

if [ "$action" = "status" ]; then
  # Print the named flag's value (or "unset"). Read-only — no upload.
  value="$(printf '%s' "$current" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
name = sys.argv[1]
print(json.dumps(data[name]) if isinstance(data, dict) and name in data else "unset")
' "$name")"
  echo "$name: $value"
  exit 0
fi

# on → true, off → false.
if [ "$action" = "on" ]; then desired=true; else desired=false; fi

# Read-modify-write: set the named key to the desired boolean, preserving every
# other key. python3 is the JSON tool present in CI and on macOS; it round-trips
# the object so an unknown key is never dropped.
updated="$(printf '%s' "$current" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
if not isinstance(data, dict):
    data = {}
name, desired = sys.argv[1], sys.argv[2] == "true"
data[name] = desired
sys.stdout.write(json.dumps(data, indent=2, sort_keys=True) + "\n")
' "$name" "$desired")"

# Upload with the runtime policy (amended AC6): `no-cache` so a flip is visible on
# the next load (Cloudflare honours it, as it does for index.html), AND an explicit
# `application/json` content-type so the browser parses the boot fetch correctly.
printf '%s' "$updated" | gcloud storage cp - "$object" \
  --cache-control="no-cache" \
  --content-type="application/json"

echo "$name -> $desired ($object)"
