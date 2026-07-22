#!/usr/bin/env bash
# Port one or more file paths from upstream/main into the current branch.
# Usage: scripts/dev/port-upstream-file.sh src/infra/outbound/sanitize-text.ts
set -euo pipefail
REMOTE="${REMOTE:-upstream}"
REF="${REF:-${REMOTE}/main}"
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path> [path...]" >&2
  echo "Example: $0 src/plugin-sdk/tool-payload.ts extensions/xai/stream.ts" >&2
  exit 1
fi
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "Missing remote '$REMOTE'. Run: scripts/dev/add-upstream-remote.sh" >&2
  exit 1
fi
git fetch "$REMOTE" main
echo "Checking out from $REF:"
for path in "$@"; do
  echo "  - $path"
done
git checkout "$REF" -- "$@"
echo "Done. Review diff, run pnpm check and scoped tests, then commit."
