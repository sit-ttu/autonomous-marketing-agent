#!/usr/bin/env bash
# Port files from a specific upstream commit (no CHANGELOG), with openclaw→foxfang import fix.
# Usage: scripts/dev/port-upstream-commit.sh <upstream-sha> <path> [path...]
set -euo pipefail
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <commit-sha> <path> [path...]" >&2
  echo "Example: $0 c637944 src/commands/doctor-cron.ts" >&2
  exit 1
fi
SHA="$1"
shift
REMOTE="${REMOTE:-upstream}"
git fetch "$REMOTE" main >/dev/null 2>&1 || true
echo "Checking out from ${SHA}:"
for path in "$@"; do
  echo "  - $path"
done
git checkout "$SHA" -- "$@"
# Drop OpenClaw changelog if it appeared
git restore --staged CHANGELOG.md 2>/dev/null || true
rm -f CHANGELOG.md 2>/dev/null || true
# Rebrand imports in ported paths (extensions + src)
for path in "$@"; do
  [[ -f "$path" ]] || continue
  if grep -q 'openclaw/plugin-sdk' "$path" 2>/dev/null; then
    echo "WARN: $path still imports openclaw/plugin-sdk — fix manually to foxfang/plugin-sdk" >&2
  fi
done
echo "Done. Run: pnpm check && bunx vitest run <related.tests>"
